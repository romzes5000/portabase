import {db} from "@/db";
import {agent, organizationAgent} from "@/db/schema/08_agent";
import {database} from "@/db/schema/07_database";
import {project} from "@/db/schema/06_project";
import {redactStorageConfig} from "@/lib/api/redact-storage-config";
import {and, asc, eq, inArray, isNull, sql} from "drizzle-orm";

function staleBackupHours(): number {
    const h = parseInt(process.env.INTERNAL_API_STALE_BACKUP_HOURS || "48", 10);
    return h > 0 ? h : 48;
}

function agentOnlineThresholdMs(): number {
    const m = parseInt(process.env.INTERNAL_API_AGENT_ONLINE_MINUTES || "15", 10);
    return (m > 0 ? m : 15) * 60 * 1000;
}

/** SQL fragment: filter by org ids, or no filter (null), or impossible (empty array). */
function sqlOrgInProject(orgIds: string[] | null, projectAlias = "p"): ReturnType<typeof sql> {
    if (orgIds === null) {
        return sql``;
    }
    if (orgIds.length === 0) {
        return sql`AND false`;
    }
    return sql`AND ${sql.raw(projectAlias)}.organization_id IN (${sql.join(
        orgIds.map((id) => sql`${id}`),
        sql`, `
    )})`;
}

const activeAgentClause = and(isNull(agent.deletedAt), eq(agent.isArchived, false));

/**
 * Internal HTTP `/api/internal/agents` and shared helpers: agents linked only via
 * databases assigned to projects in the given orgs (legacy scope).
 */
export async function agentIdsForOrganizations(orgIds: string[] | null): Promise<string[] | undefined> {
    if (orgIds === null) {
        return undefined;
    }
    if (orgIds.length === 0) {
        return [];
    }
    const projects = await db
        .select({id: project.id})
        .from(project)
        .where(and(inArray(project.organizationId, orgIds), isNull(project.deletedAt)));
    const pids = projects.map((p) => p.id);
    if (pids.length === 0) {
        return [];
    }
    const dbs = await db
        .select({agentId: database.agentId})
        .from(database)
        .where(and(inArray(database.projectId, pids), isNull(database.deletedAt)));
    return [...new Set(dbs.map((d) => d.agentId).filter(Boolean))] as string[];
}

/**
 * MCP-only org scope: {@link agentIdsForOrganizations} plus `organization_agents` and `agents.organization_id`.
 */
export async function agentIdsForMcpOrgScope(orgIds: string[] | null): Promise<string[] | undefined> {
    if (orgIds === null) {
        return undefined;
    }
    if (orgIds.length === 0) {
        return [];
    }
    const ids = new Set<string>();

    const fromDatabases = await agentIdsForOrganizations(orgIds);
    if (fromDatabases) {
        for (const id of fromDatabases) {
            ids.add(id);
        }
    }

    const fromOrgLink = await db
        .select({id: agent.id})
        .from(organizationAgent)
        .innerJoin(agent, eq(organizationAgent.agentId, agent.id))
        .where(
            and(
                inArray(organizationAgent.organizationId, orgIds),
                isNull(organizationAgent.deletedAt),
                activeAgentClause
            )
        );
    for (const r of fromOrgLink) {
        ids.add(r.id);
    }

    const fromAgentOrgColumn = await db
        .select({id: agent.id})
        .from(agent)
        .where(and(inArray(agent.organizationId, orgIds), activeAgentClause));
    for (const r of fromAgentOrgColumn) {
        ids.add(r.id);
    }

    return [...ids];
}

/** Error message shared with MCP tools that gate agent access by org scope. */
export const AGENT_MCP_ACCESS_DENIED_MESSAGE =
    "Access denied: agent is not in your selected organizations (link via Organization Agents, agents.organization_id, or a database assigned to a project in the org)";

/**
 * `ids === undefined` → no org filter (stdio / full access). Otherwise agent must be in the list.
 */
export function assertAgentIdInOrgScopeList(agentId: string, ids: string[] | undefined): void {
    if (ids !== undefined) {
        if (ids.length === 0 || !ids.includes(agentId)) {
            throw new Error(AGENT_MCP_ACCESS_DENIED_MESSAGE);
        }
    }
}

/**
 * MCP: `agentId` must appear in {@link agentIdsForMcpOrgScope}.
 * Stdio (`orgIds` from `resolveOrgScope` when `ctx` is null): `orgIds` is null → no filter.
 */
export async function assertAgentIdAllowedForMcpOrgScope(
    agentId: string,
    orgIds: string[] | null
): Promise<void> {
    const ids = await agentIdsForMcpOrgScope(orgIds);
    assertAgentIdInOrgScopeList(agentId, ids);
}

/**
 * @param useMcpOrgScope When true (MCP tools / `portabase://status`), include agents linked via
 * `organization_agents` / `agents.organization_id`. When false (default), match `GET /api/internal/agents`.
 */
export async function internalListAgents(
    orgIds: string[] | null,
    includeArchived: boolean,
    useMcpOrgScope = false
): Promise<Record<string, unknown>[]> {
    const thresholdMs = agentOnlineThresholdMs();
    const ids = useMcpOrgScope
        ? await agentIdsForMcpOrgScope(orgIds)
        : await agentIdsForOrganizations(orgIds);
    let agentIdFilter: string[] | undefined;
    if (ids !== undefined) {
        if (ids.length === 0) {
            return [];
        }
        agentIdFilter = ids;
    }
    const rows = await db.query.agent.findMany({
        where: and(
            isNull(agent.deletedAt),
            includeArchived ? undefined : eq(agent.isArchived, false),
            agentIdFilter ? inArray(agent.id, agentIdFilter) : undefined
        ),
        orderBy: [asc(agent.name)],
    });
    return rows.map((a) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        description: a.description,
        version: a.version,
        is_archived: a.isArchived,
        last_contact: a.lastContact,
        health_error_count: a.healthErrorCount,
        created_at: a.createdAt,
        online:
            a.lastContact != null &&
            Date.now() - a.lastContact.getTime() < thresholdMs,
    }));
}

export async function internalListDatabases(
    orgIds: string[] | null,
    agentId: string,
    projectId: string
): Promise<Record<string, unknown>[]> {
    const orgClause = sqlOrgInProject(orgIds, "p");
    const agentClause = agentId ? sql`AND d.agent_id = ${agentId}::uuid` : sql``;
    const projectClause = projectId ? sql`AND d.project_id = ${projectId}::uuid` : sql``;
    const result = await db.execute(sql`
    SELECT d.id::text AS id,
           d.agent_database_id::text AS agent_database_id,
           d.name,
           d.dbms::text,
           d.description,
           d.backup_policy,
           d.is_waiting_for_backup,
           d.agent_id::text,
           d.project_id::text,
           d.last_contact,
           d.created_at,
           a.name AS agent_name,
           (SELECT b.status::text FROM backups b WHERE b.database_id = d.id AND b.deleted_at IS NULL ORDER BY b.created_at DESC LIMIT 1) AS last_backup_status,
           (SELECT b.created_at FROM backups b WHERE b.database_id = d.id AND b.deleted_at IS NULL ORDER BY b.created_at DESC LIMIT 1) AS last_backup_at
    FROM databases d
    JOIN agents a ON a.id = d.agent_id AND a.deleted_at IS NULL
    JOIN projects p ON p.id = d.project_id AND p.deleted_at IS NULL
    WHERE d.deleted_at IS NULL
    ${orgClause}
    ${agentClause}
    ${projectClause}
    ORDER BY a.name, d.name
  `);
    const rows = result.rows as Record<string, unknown>[];
    return rows;
}

export async function internalListBackups(
    orgIds: string[] | null,
    databaseId: string,
    status: string,
    limit: number,
    offset: number
): Promise<Record<string, unknown>[]> {
    if (limit <= 0 || limit > 500) {
        limit = 100;
    }
    if (offset < 0) {
        offset = 0;
    }
    let orgClause: ReturnType<typeof sql>;
    if (orgIds === null) {
        orgClause = sql``;
    } else if (orgIds.length === 0) {
        orgClause = sql`AND false`;
    } else {
        orgClause = sql`AND EXISTS (SELECT 1 FROM databases d2 JOIN projects p ON p.id = d2.project_id WHERE d2.id = b.database_id AND p.organization_id IN (${sql.join(
            orgIds.map((id) => sql`${id}`),
            sql`, `
        )}) AND d2.deleted_at IS NULL AND p.deleted_at IS NULL)`;
    }
    const dbClause = databaseId ? sql`AND b.database_id = ${databaseId}::uuid` : sql``;
    const statusClause = status ? sql`AND b.status::text = ${status}` : sql``;
    const result = await db.execute(sql`
    SELECT b.id::text AS id,
           b.status::text,
           b.file,
           b.file_size,
           b.database_id::text,
           b.created_at,
           d.name AS database_name
    FROM backups b
    JOIN databases d ON d.id = b.database_id
    WHERE b.deleted_at IS NULL AND d.deleted_at IS NULL
    ${orgClause}
    ${dbClause}
    ${statusClause}
    ORDER BY b.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
    return result.rows as Record<string, unknown>[];
}

export async function internalListProjects(orgIds: string[] | null): Promise<Record<string, unknown>[]> {
    const orgClause = sqlOrgInProject(orgIds, "p");
    const result = await db.execute(sql`
    SELECT p.id::text,
           p.slug,
           p.name,
           p.is_archived,
           p.organization_id::text,
           p.created_at,
           (SELECT COUNT(*)::int FROM databases d WHERE d.project_id = p.id AND d.deleted_at IS NULL) AS database_count
    FROM projects p
    WHERE p.deleted_at IS NULL
    ${orgClause}
    ORDER BY p.name
  `);
    return result.rows as Record<string, unknown>[];
}

export async function internalListOrganizations(orgIds: string[] | null): Promise<Record<string, unknown>[]> {
    if (orgIds === null) {
        const result = await db.execute(sql`
    SELECT o.id::text,
           o.slug,
           o.name,
           o.logo,
           o.metadata,
           o.created_at,
           o.updated_at,
           (SELECT COUNT(*)::int FROM projects p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) AS project_count,
           (SELECT COUNT(*)::int FROM databases d
              INNER JOIN projects p ON p.id = d.project_id AND p.deleted_at IS NULL
              WHERE p.organization_id = o.id AND d.deleted_at IS NULL) AS database_count
    FROM organization o
    WHERE o.deleted_at IS NULL
    ORDER BY o.name
  `);
        return result.rows as Record<string, unknown>[];
    }
    if (orgIds.length === 0) {
        return [];
    }
    const result = await db.execute(sql`
      SELECT o.id::text,
             o.slug,
             o.name,
             o.logo,
             o.metadata,
             o.created_at,
             o.updated_at,
             (SELECT COUNT(*)::int FROM projects p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) AS project_count,
             (SELECT COUNT(*)::int FROM databases d
                INNER JOIN projects p ON p.id = d.project_id AND p.deleted_at IS NULL
                WHERE p.organization_id = o.id AND d.deleted_at IS NULL) AS database_count
      FROM organization o
      WHERE o.deleted_at IS NULL AND o.id IN (${sql.join(
          orgIds.map((id) => sql`${id}`),
          sql`, `
      )})
      ORDER BY o.name
    `);
    return result.rows as Record<string, unknown>[];
}

export async function internalGetBackupStatus(orgIds: string[] | null): Promise<Record<string, unknown>> {
    const staleH = staleBackupHours();
    let orgFilter: ReturnType<typeof sql>;
    let recentOrgFilter: ReturnType<typeof sql>;
    if (orgIds === null) {
        orgFilter = sql``;
        recentOrgFilter = sql``;
    } else if (orgIds.length === 0) {
        orgFilter = sql`AND false`;
        recentOrgFilter = sql`AND false`;
    } else {
        const inList = sql.join(
            orgIds.map((id) => sql`${id}`),
            sql`, `
        );
        const inListRecent = sql.join(
            orgIds.map((id) => sql`${id}`),
            sql`, `
        );
        orgFilter = sql`AND EXISTS (SELECT 1 FROM projects p WHERE p.id = d.project_id AND p.organization_id IN (${inList}) AND p.deleted_at IS NULL)`;
        recentOrgFilter = sql`AND EXISTS (SELECT 1 FROM projects p WHERE p.id = d.project_id AND p.organization_id IN (${inListRecent}) AND p.deleted_at IS NULL)`;
    }
    const row = await db.execute(sql`
    WITH db AS (
      SELECT d.id, d.name,
        (SELECT b.status FROM backups b WHERE b.database_id = d.id AND b.deleted_at IS NULL ORDER BY b.created_at DESC LIMIT 1) AS last_status,
        (SELECT b.created_at FROM backups b WHERE b.database_id = d.id AND b.status = 'success' AND b.deleted_at IS NULL ORDER BY b.created_at DESC LIMIT 1) AS last_success_at
      FROM databases d
      WHERE d.deleted_at IS NULL
      ${orgFilter}
    )
    SELECT
      COUNT(*)::int AS total_databases,
      COUNT(*) FILTER (WHERE last_success_at IS NULL)::int AS never_success,
      COUNT(*) FILTER (WHERE last_success_at IS NOT NULL AND last_success_at < now() - (${staleH}::int * interval '1 hour'))::int AS stale_success
    FROM db
  `);
    const first = (row.rows[0] ?? {}) as Record<string, unknown>;
    const recent = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM backups b
    JOIN databases d ON d.id = b.database_id
    WHERE b.created_at > now() - interval '24 hours'
      AND b.deleted_at IS NULL AND d.deleted_at IS NULL
      ${recentOrgFilter}
  `);
    const recent24 = Number((recent.rows[0] as {c?: number})?.c ?? 0);
    return {
        total_databases: first.total_databases,
        databases_without_success: first.never_success,
        stale_databases_hours: staleH,
        databases_stale_last_success: first.stale_success,
        backups_last_24h: recent24,
    };
}

export async function internalListStorageChannels(orgIds: string[] | null): Promise<Record<string, unknown>[]> {
    let orgClause: ReturnType<typeof sql>;
    if (orgIds === null) {
        orgClause = sql``;
    } else if (orgIds.length === 0) {
        orgClause = sql`AND false`;
    } else {
        const inListSc = sql.join(
            orgIds.map((id) => sql`${id}`),
            sql`, `
        );
        const inListOsc = sql.join(
            orgIds.map((id) => sql`${id}`),
            sql`, `
        );
        orgClause = sql`AND (sc.organization_id IN (${inListSc}) OR EXISTS (SELECT 1 FROM organization_storage_channels osc WHERE osc.storage_channel_id = sc.id AND osc.organization_id IN (${inListOsc})))`;
    }
    const result = await db.execute(sql`
    SELECT sc.id::text,
           COALESCE(sc.organization_id::text, '') AS organization_id,
           sc.provider::text,
           sc.name,
           sc.enabled,
           sc.config,
           sc.created_at,
           COALESCE(SUM(bs.size), 0)::bigint AS total_backup_bytes,
           COUNT(bs.id)::int AS backup_storage_rows
    FROM storage_channel sc
    LEFT JOIN backup_storage bs ON bs.storage_channel_id = sc.id AND bs.deleted_at IS NULL
    WHERE sc.deleted_at IS NULL
    ${orgClause}
    GROUP BY sc.id, sc.organization_id, sc.provider, sc.name, sc.enabled, sc.config, sc.created_at
    ORDER BY sc.name
  `);
    const rows = result.rows as Record<string, unknown>[];
    return rows.map((r) => {
        const config = redactStorageConfig(r.config);
        const out: Record<string, unknown> = {
            id: r.id,
            provider: r.provider,
            name: r.name,
            enabled: r.enabled,
            config,
            created_at: r.created_at,
            total_backup_bytes: r.total_backup_bytes,
            backup_storage_rows: r.backup_storage_rows,
        };
        const oid = r.organization_id;
        if (oid != null && String(oid) !== "") {
            out.organization_id = oid;
        }
        return out;
    });
}

export async function internalListNotificationChannels(orgIds: string[] | null): Promise<Record<string, unknown>[]> {
    let orgClause: ReturnType<typeof sql>;
    if (orgIds === null) {
        orgClause = sql``;
    } else if (orgIds.length === 0) {
        orgClause = sql`AND false`;
    } else {
        const inListNc = sql.join(
            orgIds.map((id) => sql`${id}`),
            sql`, `
        );
        const inListOnc = sql.join(
            orgIds.map((id) => sql`${id}`),
            sql`, `
        );
        orgClause = sql`AND (nc.organization_id IN (${inListNc}) OR EXISTS (SELECT 1 FROM organization_notification_channels onc WHERE onc.notification_channel_id = nc.id AND onc.organization_id IN (${inListOnc})))`;
    }
    const result = await db.execute(sql`
    SELECT nc.id::text,
           COALESCE(nc.organization_id::text, '') AS organization_id,
           nc.provider::text,
           nc.name,
           nc.enabled,
           nc.config,
           nc.created_at
    FROM notification_channel nc
    WHERE nc.deleted_at IS NULL
    ${orgClause}
    ORDER BY nc.name
  `);
    const rows = result.rows as Record<string, unknown>[];
    return rows.map((r) => {
        const config = redactStorageConfig(r.config);
        const out: Record<string, unknown> = {
            id: r.id,
            provider: r.provider,
            name: r.name,
            enabled: r.enabled,
            config,
            created_at: r.created_at,
        };
        const oid = r.organization_id;
        if (oid != null && String(oid) !== "") {
            out.organization_id = oid;
        }
        return out;
    });
}
