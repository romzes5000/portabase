import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {internalListOrganizations} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgForTool} from "@/mcp/org-scope";

export function registerListOrganizations(
    server: McpServer,
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): void {
    server.registerTool(
        "list_organizations",
        {
            description:
                "List organizations (id, slug, name, …) with project_count and database_count. Use id as list_projects(organization_id) to filter projects; there is no separate filter on slug in list_projects.",
            annotations: {readOnlyHint: true},
        },
        async () => {
            try {
                const orgId = resolveOrgForTool(apiKey, null);
                const rows = await internalListOrganizations(orgId);
                return toolOk({ok: true, organizations: rows});
            } catch (e) {
                return toolErr("list_organizations", e);
            }
        }
    );
}
