import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalListOrganizations} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerListOrganizations(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "list_organizations",
        {
            description:
                "List organizations (id, slug, name, …) with project_count and database_count. Use id as list_projects(organization_id) to filter projects; there is no separate filter on slug in list_projects.",
            annotations: {readOnlyHint: true},
        },
        async () => {
            try {
                const scope = resolveOrgScope(ctx, null);
                const rows = await internalListOrganizations(scope.orgIds);
                return toolOk({ok: true, organizations: rows});
            } catch (e) {
                return toolErr("list_organizations", e);
            }
        }
    );
}
