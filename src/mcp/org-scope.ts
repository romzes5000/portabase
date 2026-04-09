import {loadMcpContext, type McpContext, type VerifiedApiKey} from "@/lib/api/internal-auth";

/** null orgIds = no org filter (stdio / full DB access). */
export type OrgScope = {orgIds: string[] | null};

export class OrgAccessDeniedError extends Error {
    constructor(organizationId: string) {
        super(`Access denied: not a member of organization ${organizationId}`);
        this.name = "OrgAccessDeniedError";
    }
}

/** User is member but not owner/admin (variant B for destructive org operations). */
export class OrgRoleDeniedError extends Error {
    constructor(organizationId: string) {
        super(`Access denied: organization ${organizationId} requires owner or admin role`);
        this.name = "OrgRoleDeniedError";
    }
}

/**
 * HTTP MCP: require owner or admin in org. Stdio (`ctx === null`): no check.
 */
export function requireOrgOwnerOrAdmin(ctx: McpContext | null, organizationId: string): void {
    if (!ctx) {
        return;
    }
    const m = ctx.memberships.find((x) => x.organizationId === organizationId);
    if (!m || (m.role !== "owner" && m.role !== "admin")) {
        throw new OrgRoleDeniedError(organizationId);
    }
}

/** Resolves org scope for HTTP internal API after API key auth. */
export async function loadOrgScopeForApiKey(
    key: VerifiedApiKey,
    queryOrganizationId: string | null
): Promise<OrgScope> {
    const ctx = await loadMcpContext(key);
    return resolveOrgScope(ctx, queryOrganizationId);
}

/**
 * Stdio MCP: ctx is null → optional single-org hint from query, or full access.
 * HTTP MCP: ctx has allowedOrgIds; empty query → all orgs the user belongs to.
 */
export function resolveOrgScope(
    ctx: McpContext | null,
    queryOrganizationId: string | null
): OrgScope {
    if (!ctx) {
        return {orgIds: queryOrganizationId ? [queryOrganizationId] : null};
    }
    if (!queryOrganizationId) {
        return {orgIds: ctx.allowedOrgIds};
    }
    if (!ctx.allowedOrgIds.includes(queryOrganizationId)) {
        throw new OrgAccessDeniedError(queryOrganizationId);
    }
    return {orgIds: [queryOrganizationId]};
}
