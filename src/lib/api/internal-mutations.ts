import {v4 as uuidv4} from "uuid";
import {and, count, eq, inArray, isNull, ne} from "drizzle-orm";

import {db} from "@/db";
import * as drizzleDb from "@/db";
import type {McpContext} from "@/lib/api/internal-auth";
import {agentIdsForOrganizations} from "@/lib/api/internal-queries";
import {OrgAccessDeniedError, requireOrgOwnerOrAdmin} from "@/mcp/org-scope";
import {slugify} from "@/utils/slugify";

function assertOrgInScope(orgIds: string[] | null, organizationId: string): void {
    if (orgIds === null) {
        return;
    }
    if (!orgIds.includes(organizationId)) {
        throw new OrgAccessDeniedError(organizationId);
    }
}

/** Returns organization id via database → project, or null if unassigned. */
export async function getDatabaseOrganizationId(databaseId: string): Promise<string | null> {
    const row = await db.query.database.findFirst({
        where: and(eq(drizzleDb.schemas.database.id, databaseId), isNull(drizzleDb.schemas.database.deletedAt)),
        with: {
            project: true,
        },
    });
    if (!row?.projectId || !row.project) {
        return null;
    }
    return row.project.organizationId;
}

async function assertDatabaseInOrgScope(databaseId: string, orgIds: string[] | null): Promise<string> {
    const orgId = await getDatabaseOrganizationId(databaseId);
    if (!orgId) {
        throw new Error("Database must be assigned to a project in an organization for this operation");
    }
    assertOrgInScope(orgIds, orgId);
    return orgId;
}

async function verifyAgentSlugUnique(slug: string, excludeAgentId?: string): Promise<void> {
    const conditions = excludeAgentId
        ? and(eq(drizzleDb.schemas.agent.slug, slug), ne(drizzleDb.schemas.agent.id, excludeAgentId))
        : eq(drizzleDb.schemas.agent.slug, slug);
    const [c] = await db.select({n: count()}).from(drizzleDb.schemas.agent).where(conditions);
    if ((c?.n ?? 0) > 0) {
        throw new Error("Agent slug already exists");
    }
}

async function verifyProjectSlugUnique(slug: string, excludeProjectId?: string): Promise<void> {
    const conditions = excludeProjectId
        ? and(eq(drizzleDb.schemas.project.slug, slug), ne(drizzleDb.schemas.project.id, excludeProjectId))
        : eq(drizzleDb.schemas.project.slug, slug);
    const [c] = await db.select({n: count()}).from(drizzleDb.schemas.project).where(conditions);
    if ((c?.n ?? 0) > 0) {
        throw new Error("Project slug already exists");
    }
}

export async function internalTriggerBackup(
    databaseId: string,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.backup.$inferSelect> {
    void ctx;
    await assertDatabaseInOrgScope(databaseId, orgIds);
    const [row] = await db
        .insert(drizzleDb.schemas.backup)
        .values({databaseId, status: "waiting"})
        .returning();
    if (!row) {
        throw new Error("Failed to create backup");
    }
    return row;
}

export async function internalCreateProject(
    name: string,
    organizationId: string,
    databaseIds: string[] | undefined,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.project.$inferSelect> {
    void ctx;
    assertOrgInScope(orgIds, organizationId);
    const slug = slugify(name);
    await verifyProjectSlugUnique(slug);

    const existingName = await db.query.project.findFirst({
        where: eq(drizzleDb.schemas.project.name, name),
    });
    if (existingName) {
        throw new Error("A project with this name already exists");
    }

    const [created] = await db
        .insert(drizzleDb.schemas.project)
        .values({name, slug, organizationId})
        .returning();
    if (!created) {
        throw new Error("Failed to create project");
    }

    if (databaseIds && databaseIds.length > 0) {
        for (const dbId of databaseIds) {
            const oid = await getDatabaseOrganizationId(dbId);
            if (oid && oid !== organizationId) {
                throw new Error(`Database ${dbId} belongs to another organization`);
            }
        }
        await db
            .update(drizzleDb.schemas.database)
            .set({projectId: created.id})
            .where(inArray(drizzleDb.schemas.database.id, databaseIds));
    }

    return created;
}

export async function internalUpdateProject(
    projectId: string,
    data: {name: string; databases: string[]},
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.project.$inferSelect> {
    void ctx;
    const existing = await db.query.project.findFirst({
        where: and(eq(drizzleDb.schemas.project.id, projectId), isNull(drizzleDb.schemas.project.deletedAt)),
        with: {databases: true},
    });
    if (!existing) {
        throw new Error("Project not found");
    }
    assertOrgInScope(orgIds, existing.organizationId);

    const existingDbIds = existing.databases.map((d) => d.id);
    const newDbIds = data.databases;
    const databasesToAdd = newDbIds.filter((id) => !existingDbIds.includes(id));
    const databasesToRemove = existingDbIds.filter((id) => !newDbIds.includes(id));

    if (databasesToAdd.length > 0) {
        await db
            .update(drizzleDb.schemas.database)
            .set({projectId})
            .where(inArray(drizzleDb.schemas.database.id, databasesToAdd));
    }
    if (databasesToRemove.length > 0) {
        await db
            .update(drizzleDb.schemas.database)
            .set({projectId: null, backupPolicy: null})
            .where(inArray(drizzleDb.schemas.database.id, databasesToRemove));
        await db
            .delete(drizzleDb.schemas.retentionPolicy)
            .where(inArray(drizzleDb.schemas.retentionPolicy.databaseId, databasesToRemove));
        await db
            .delete(drizzleDb.schemas.alertPolicy)
            .where(inArray(drizzleDb.schemas.alertPolicy.databaseId, databasesToRemove));
    }

    const newSlug = slugify(data.name);
    await verifyProjectSlugUnique(newSlug, projectId);

    const [updated] = await db
        .update(drizzleDb.schemas.project)
        .set({name: data.name, slug: newSlug})
        .where(eq(drizzleDb.schemas.project.id, projectId))
        .returning();
    if (!updated) {
        throw new Error("Failed to update project");
    }
    return updated;
}

export async function internalDeleteProject(
    projectId: string,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.project.$inferSelect> {
    const existing = await db.query.project.findFirst({
        where: and(eq(drizzleDb.schemas.project.id, projectId), isNull(drizzleDb.schemas.project.deletedAt)),
    });
    if (!existing) {
        throw new Error("Project not found");
    }
    assertOrgInScope(orgIds, existing.organizationId);
    requireOrgOwnerOrAdmin(ctx, existing.organizationId);

    const uuid = uuidv4();
    const databasesUpdated = await db
        .update(drizzleDb.schemas.database)
        .set({projectId: null, backupPolicy: null})
        .where(eq(drizzleDb.schemas.database.projectId, projectId))
        .returning();
    const databasesToRemove = databasesUpdated.map((d) => d.id);
    if (databasesToRemove.length > 0) {
        await db
            .delete(drizzleDb.schemas.retentionPolicy)
            .where(inArray(drizzleDb.schemas.retentionPolicy.databaseId, databasesToRemove));
    }

    const [updated] = await db
        .update(drizzleDb.schemas.project)
        .set({isArchived: true, slug: uuid, name: uuid})
        .where(eq(drizzleDb.schemas.project.id, projectId))
        .returning();
    if (!updated) {
        throw new Error("Failed to archive project");
    }
    return updated;
}

export async function internalCreateAgent(
    name: string,
    description: string,
    _orgIds: string[] | null,
    _ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.agent.$inferSelect> {
    void _orgIds;
    void _ctx;
    const slug = slugify(name);
    await verifyAgentSlugUnique(slug);
    const [row] = await db
        .insert(drizzleDb.schemas.agent)
        .values({name, description, slug})
        .returning();
    if (!row) {
        throw new Error("Failed to create agent");
    }
    return row;
}

export async function internalUpdateAgent(
    agentId: string,
    data: {name: string; description: string},
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.agent.$inferSelect> {
    void ctx;
    const ids = await agentIdsForOrganizations(orgIds);
    if (ids !== undefined) {
        if (ids.length === 0 || !ids.includes(agentId)) {
            throw new Error("Access denied: agent not in scope for your organizations");
        }
    }
    const slug = slugify(data.name);
    await verifyAgentSlugUnique(slug, agentId);
    const [row] = await db
        .update(drizzleDb.schemas.agent)
        .set({...data, slug})
        .where(eq(drizzleDb.schemas.agent.id, agentId))
        .returning();
    if (!row) {
        throw new Error("Agent not found");
    }
    return row;
}

async function agentOrgIdsForDeleteCheck(agentId: string): Promise<string[]> {
    const rows = await db
        .selectDistinct({oid: drizzleDb.schemas.project.organizationId})
        .from(drizzleDb.schemas.database)
        .innerJoin(
            drizzleDb.schemas.project,
            eq(drizzleDb.schemas.database.projectId, drizzleDb.schemas.project.id)
        )
        .where(
            and(
                eq(drizzleDb.schemas.database.agentId, agentId),
                isNull(drizzleDb.schemas.database.deletedAt),
                isNull(drizzleDb.schemas.project.deletedAt)
            )
        );
    return rows.map((r) => r.oid).filter(Boolean) as string[];
}

function requireOwnerOrAdminInAnyOrg(ctx: McpContext | null, orgIds: string[]): void {
    if (!ctx) {
        return;
    }
    if (orgIds.length === 0) {
        throw new Error("Access denied: cannot verify organization admin role for this agent");
    }
    const ok = orgIds.some((oid) => {
        const m = ctx.memberships.find((x) => x.organizationId === oid);
        return m && (m.role === "owner" || m.role === "admin");
    });
    if (!ok) {
        throw new Error("Access denied: requires owner or admin in an organization that uses this agent");
    }
}

export async function internalDeleteAgent(
    agentId: string,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.agent.$inferSelect> {
    const linkedOrgs = await agentOrgIdsForDeleteCheck(agentId);
    if (orgIds !== null && linkedOrgs.length > 0) {
        const intersect = linkedOrgs.filter((o) => orgIds.includes(o));
        if (intersect.length === 0) {
            throw new Error("Access denied: agent not in scope");
        }
    }
    if (linkedOrgs.length > 0) {
        const toCheck =
            orgIds === null ? linkedOrgs : linkedOrgs.filter((o) => orgIds.includes(o));
        requireOwnerOrAdminInAnyOrg(ctx, toCheck);
    }

    const uuid = uuidv4();
    const [row] = await db
        .update(drizzleDb.schemas.agent)
        .set({isArchived: true, slug: uuid})
        .where(eq(drizzleDb.schemas.agent.id, agentId))
        .returning();
    if (!row) {
        throw new Error("Agent not found");
    }
    return row;
}

export async function internalUpdateDatabase(
    databaseId: string,
    description: string | undefined,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.database.$inferSelect> {
    void ctx;
    await assertDatabaseInOrgScope(databaseId, orgIds);
    if (description === undefined) {
        const row = await db.query.database.findFirst({
            where: eq(drizzleDb.schemas.database.id, databaseId),
        });
        if (!row) {
            throw new Error("Database not found");
        }
        return row;
    }
    const [row] = await db
        .update(drizzleDb.schemas.database)
        .set({description})
        .where(eq(drizzleDb.schemas.database.id, databaseId))
        .returning();
    if (!row) {
        throw new Error("Database not found");
    }
    return row;
}

export async function internalAssignDatabaseProject(
    databaseId: string,
    projectId: string | null,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.database.$inferSelect> {
    void ctx;
    if (projectId) {
        const proj = await db.query.project.findFirst({
            where: and(eq(drizzleDb.schemas.project.id, projectId), isNull(drizzleDb.schemas.project.deletedAt)),
        });
        if (!proj) {
            throw new Error("Project not found");
        }
        assertOrgInScope(orgIds, proj.organizationId);
    } else if (orgIds !== null) {
        const oid = await getDatabaseOrganizationId(databaseId);
        if (oid) {
            assertOrgInScope(orgIds, oid);
        }
    }
    const [row] = await db
        .update(drizzleDb.schemas.database)
        .set({projectId})
        .where(eq(drizzleDb.schemas.database.id, databaseId))
        .returning();
    if (!row) {
        throw new Error("Database not found");
    }
    return row;
}

export async function internalSetBackupSchedule(
    databaseId: string,
    cron: string,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.database.$inferSelect> {
    void ctx;
    await assertDatabaseInOrgScope(databaseId, orgIds);
    const cronPolicy = cron === "" ? null : cron;
    const [updated] = await db
        .update(drizzleDb.schemas.database)
        .set({backupPolicy: cronPolicy})
        .where(eq(drizzleDb.schemas.database.id, databaseId))
        .returning();
    if (!updated) {
        throw new Error("Database not found");
    }
    if (cronPolicy == null) {
        await db
            .delete(drizzleDb.schemas.retentionPolicy)
            .where(eq(drizzleDb.schemas.retentionPolicy.databaseId, databaseId));
    }
    return updated;
}

export type RetentionInput = {
    type: "count" | "days" | "gfs";
    count?: number;
    days?: number;
    gfsDaily?: number;
    gfsWeekly?: number;
    gfsMonthly?: number;
    gfsYearly?: number;
};

export async function internalSetRetentionPolicy(
    databaseId: string,
    settings: RetentionInput,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.retentionPolicy.$inferSelect> {
    void ctx;
    await assertDatabaseInOrgScope(databaseId, orgIds);

    const existing = await db
        .select()
        .from(drizzleDb.schemas.retentionPolicy)
        .where(eq(drizzleDb.schemas.retentionPolicy.databaseId, databaseId))
        .limit(1);

    const values = {
        type: settings.type,
        count: settings.count ?? 7,
        days: settings.days ?? 30,
        gfsDaily: settings.gfsDaily ?? 7,
        gfsWeekly: settings.gfsWeekly ?? 4,
        gfsMonthly: settings.gfsMonthly ?? 12,
        gfsYearly: settings.gfsYearly ?? 3,
    };

    if (existing.length > 0) {
        const [u] = await db
            .update(drizzleDb.schemas.retentionPolicy)
            .set(values)
            .where(eq(drizzleDb.schemas.retentionPolicy.databaseId, databaseId))
            .returning();
        if (!u) {
            throw new Error("Failed to update retention policy");
        }
        return u;
    }
    const [ins] = await db
        .insert(drizzleDb.schemas.retentionPolicy)
        .values({databaseId, ...values})
        .returning();
    if (!ins) {
        throw new Error("Failed to create retention policy");
    }
    return ins;
}

export type AlertPolicyInput = {
    channelId: string;
    eventKinds?: Array<
        | "error_backup"
        | "error_restore"
        | "success_restore"
        | "success_backup"
        | "weekly_report"
        | "error_health_database"
    >;
    enabled?: boolean;
};

export async function internalSetAlertPolicies(
    databaseId: string,
    policies: AlertPolicyInput[],
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<void> {
    void ctx;
    await assertDatabaseInOrgScope(databaseId, orgIds);
    await db.delete(drizzleDb.schemas.alertPolicy).where(eq(drizzleDb.schemas.alertPolicy.databaseId, databaseId));
    if (policies.length === 0) {
        return;
    }
    const rows = policies.map((p) => ({
        databaseId,
        notificationChannelId: p.channelId,
        eventKinds: (p.eventKinds?.length ? p.eventKinds : (["error_backup"] as const)) as Array<
            | "error_backup"
            | "error_restore"
            | "success_restore"
            | "success_backup"
            | "weekly_report"
            | "error_health_agent"
            | "error_health_database"
        >,
        enabled: p.enabled ?? true,
    }));
    await db.insert(drizzleDb.schemas.alertPolicy).values(rows);
}

export type StoragePolicyInput = {channelId: string; enabled?: boolean};

export async function internalSetStoragePolicies(
    databaseId: string,
    policies: StoragePolicyInput[],
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<void> {
    void ctx;
    await assertDatabaseInOrgScope(databaseId, orgIds);
    await db.delete(drizzleDb.schemas.storagePolicy).where(eq(drizzleDb.schemas.storagePolicy.databaseId, databaseId));
    if (policies.length === 0) {
        return;
    }
    await db.insert(drizzleDb.schemas.storagePolicy).values(
        policies.map((p) => ({
            databaseId,
            storageChannelId: p.channelId,
            enabled: p.enabled ?? true,
        }))
    );
}

export async function internalCreateOrganization(
    name: string,
    userId: string,
    _orgIds: string[] | null,
    _ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.organization.$inferSelect> {
    void _orgIds;
    void _ctx;
    const slug = slugify(name);
    const taken = await db.query.organization.findFirst({
        where: eq(drizzleDb.schemas.organization.slug, slug),
    });
    if (taken) {
        throw new Error("Organization slug already taken");
    }
    const [org] = await db
        .insert(drizzleDb.schemas.organization)
        .values({name, slug})
        .returning();
    if (!org) {
        throw new Error("Failed to create organization");
    }
    await db.insert(drizzleDb.schemas.member).values({
        userId,
        organizationId: org.id,
        role: "owner",
    });
    return org;
}

export async function internalUpdateOrganization(
    organizationId: string,
    data: {name?: string; slug?: string},
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.organization.$inferSelect> {
    assertOrgInScope(orgIds, organizationId);
    requireOrgOwnerOrAdmin(ctx, organizationId);
    const [row] = await db
        .update(drizzleDb.schemas.organization)
        .set({
            ...(data.name !== undefined ? {name: data.name} : {}),
            ...(data.slug !== undefined ? {slug: data.slug} : {}),
        })
        .where(eq(drizzleDb.schemas.organization.id, organizationId))
        .returning();
    if (!row) {
        throw new Error("Organization not found");
    }
    return row;
}

export async function internalDeleteOrganization(
    organizationId: string,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.organization.$inferSelect> {
    assertOrgInScope(orgIds, organizationId);
    requireOrgOwnerOrAdmin(ctx, organizationId);
    const [row] = await db
        .delete(drizzleDb.schemas.organization)
        .where(eq(drizzleDb.schemas.organization.id, organizationId))
        .returning();
    if (!row) {
        throw new Error("Organization not found");
    }
    return row;
}

async function storageChannelOrganizationIds(channelId: string): Promise<string[]> {
    const ch = await db.query.storageChannel.findFirst({
        where: and(eq(drizzleDb.schemas.storageChannel.id, channelId), isNull(drizzleDb.schemas.storageChannel.deletedAt)),
    });
    const ids: string[] = [];
    if (ch?.organizationId) {
        ids.push(ch.organizationId);
    }
    const links = await db
        .select()
        .from(drizzleDb.schemas.organizationStorageChannel)
        .where(eq(drizzleDb.schemas.organizationStorageChannel.storageChannelId, channelId));
    for (const l of links) {
        ids.push(l.organizationId);
    }
    return [...new Set(ids)];
}

function requireStorageChannelOrgs(
    ctx: McpContext | null,
    orgIds: string[] | null,
    channelOrgIds: string[]
): void {
    if (channelOrgIds.length === 0) {
        if (ctx) {
            throw new Error(
                "Storage channel is not linked to any organization; assign it in the UI or use stdio MCP"
            );
        }
        return;
    }
    for (const oid of channelOrgIds) {
        assertOrgInScope(orgIds, oid);
        requireOrgOwnerOrAdmin(ctx, oid);
    }
}

export async function internalCreateStorageChannel(
    organizationId: string | undefined,
    provider: "local" | "s3" | "google-drive",
    name: string,
    config: Record<string, unknown>,
    enabled: boolean,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.storageChannel.$inferSelect> {
    if (organizationId) {
        assertOrgInScope(orgIds, organizationId);
        requireOrgOwnerOrAdmin(ctx, organizationId);
    } else if (ctx) {
        throw new Error("organization_id is required for HTTP MCP");
    }

    const [ch] = await db
        .insert(drizzleDb.schemas.storageChannel)
        .values({
            provider,
            name,
            config,
            enabled,
            organizationId: organizationId ?? null,
        })
        .returning();
    if (!ch) {
        throw new Error("Failed to create storage channel");
    }
    if (organizationId) {
        await db.insert(drizzleDb.schemas.organizationStorageChannel).values({
            organizationId,
            storageChannelId: ch.id,
        });
    }
    return ch;
}

export async function internalUpdateStorageChannel(
    channelId: string,
    data: {name?: string; config?: Record<string, unknown>; enabled?: boolean},
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.storageChannel.$inferSelect> {
    const channelOrgs = await storageChannelOrganizationIds(channelId);
    requireStorageChannelOrgs(ctx, orgIds, channelOrgs);

    const [row] = await db
        .update(drizzleDb.schemas.storageChannel)
        .set({
            ...(data.name !== undefined ? {name: data.name} : {}),
            ...(data.config !== undefined ? {config: data.config} : {}),
            ...(data.enabled !== undefined ? {enabled: data.enabled} : {}),
        })
        .where(eq(drizzleDb.schemas.storageChannel.id, channelId))
        .returning();
    if (!row) {
        throw new Error("Storage channel not found");
    }
    return row;
}

export async function internalDeleteStorageChannel(
    channelId: string,
    orgIds: string[] | null,
    ctx: McpContext | null
): Promise<typeof drizzleDb.schemas.storageChannel.$inferSelect> {
    const channelOrgs = await storageChannelOrganizationIds(channelId);
    requireStorageChannelOrgs(ctx, orgIds, channelOrgs);

    for (const oid of channelOrgs) {
        await db
            .delete(drizzleDb.schemas.organizationStorageChannel)
            .where(
                and(
                    eq(drizzleDb.schemas.organizationStorageChannel.organizationId, oid),
                    eq(drizzleDb.schemas.organizationStorageChannel.storageChannelId, channelId)
                )
            );
    }

    const [row] = await db
        .delete(drizzleDb.schemas.storageChannel)
        .where(eq(drizzleDb.schemas.storageChannel.id, channelId))
        .returning();
    if (!row) {
        throw new Error("Storage channel not found");
    }
    return row;
}
