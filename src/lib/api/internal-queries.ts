import {db} from "@/db";
import {agent} from "@/db/schema/08_agent";
import {database} from "@/db/schema/07_database";
import {project} from "@/db/schema/06_project";
import type {VerifiedApiKey} from "@/lib/api/internal-auth";
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

/** Effective org filter: scoped API key wins over query param. */
export function resolveOrganizationId(
    key: VerifiedApiKey,
    queryOrganizationId: string | null
): string | null {
    if (key.organizationId) {
        return key.organizationId;
    }
    return queryOrganizationId;
}

async function agentIdsForOrganization(orgId: string): Promise<string[]> {
    const projects = await db
        .select({id: project.id})
        .from(project)
        .where(and(eq(project.organizationId, orgId), isNull(project.deletedAt)));
    const pids = projects.map((p) => p.id);
    if (pids.length === 0) {
        return [];
    }
    const dbs = await db
        .select({agentId: database.agentId})
        .from(database)
        .where(and(inArray(database.projectId, pids), isNull(database.deletedAt)));
    return [...new Set(dbs.map((d) => d.agentId))];
}

export async function internalListAgents(
    orgId: string | null,
    includeArchived: boolean
): Promise<Record<string, unknown>[]> {
    const thresholdMs = agentOnlineThresholdMs();
    let agentIdFilter: string[] | undefined;
    if (orgId) {
        const ids = await agentIdsForOrganization(orgId);
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
    orgId: string | null,
    agentId: string,
    projectId: string
): Promise<Record<string, unknown>[]> {
    const orgClause = orgId ? sql`AND p.organization_id = ${orgId}::uuid` : sql``;
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
    orgId: string | null,
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
    const orgClause = orgId
        ? sql`AND EXISTS (SELECT 1 FROM databases d2 JOIN projects p ON p.id = d2.project_id WHERE d2.id = b.database_id AND p.organization_id = ${orgId}::uuid AND d2.deleted_at IS NULL AND p.deleted_at IS NULL)`
        : sql``;
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

export async function internalListProjects(orgId: string | null): Promise<Record<string, unknown>[]> {
    const orgClause = orgId ? sql`AND p.organization_id = ${orgId}::uuid` : sql``;
    const result = await db.execute(sql`
    SELECT p.id::text,
           p.slug,
           p.name,
           p.is_archived,
           p.organization_id::text,
           p.created_at,
           (SELECT COUNT(*)::int FROM databases d WHERE d.project_id = p.id AND d.deleted_at IS NULL) AS database_count,
           (SELECT COUNT(DISTINCT d.agent_id)::int FROM databases d WHERE d.project_id = p.id AND d.deleted_at IS NULL) AS agent_count
    FROM projects p
    WHERE p.deleted_at IS NULL
    ${orgClause}
    ORDER BY p.name
  `);
    return result.rows as Record<string, unknown>[];
}

export async function internalListOrganizations(orgId: string | null): Promise<Record<string, unknown>[]> {
    if (orgId) {
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
      WHERE o.deleted_at IS NULL AND o.id = ${orgId}::uuid
      ORDER BY o.name
    `);
        return result.rows as Record<string, unknown>[];
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
    WHERE o.deleted_at IS NULL
    ORDER BY o.name
  `);
    return result.rows as Record<string, unknown>[];
}

export async function internalGetBackupStatus(orgId: string | null): Promise<Record<string, unknown>> {
    const staleH = staleBackupHours();
    const orgFilter = orgId
        ? sql`AND EXISTS (SELECT 1 FROM projects p WHERE p.id = d.project_id AND p.organization_id = ${orgId}::uuid AND p.deleted_at IS NULL)`
        : sql``;
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
      ${orgId ? sql`AND EXISTS (SELECT 1 FROM projects p WHERE p.id = d.project_id AND p.organization_id = ${orgId}::uuid AND p.deleted_at IS NULL)` : sql``}
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

export async function internalListStorageChannels(orgId: string | null): Promise<Record<string, unknown>[]> {
    const orgClause = orgId
        ? sql`AND (sc.organization_id = ${orgId}::uuid OR EXISTS (SELECT 1 FROM organization_storage_channels osc WHERE osc.storage_channel_id = sc.id AND osc.organization_id = ${orgId}::uuid))`
        : sql``;
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
