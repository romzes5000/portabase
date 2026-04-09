import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalDeleteOrganization} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerDeleteOrganization(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "delete_organization",
        {
            description:
                "Delete an organization (cascades). Requires owner or admin in the organization.",
            inputSchema: z.object({
                organization_id: z.string().uuid(),
            }),
            annotations: {readOnlyHint: false, destructiveHint: true},
        },
        async (args) => {
            try {
                const scope = resolveOrgScope(ctx, args.organization_id);
                const row = await internalDeleteOrganization(args.organization_id, scope.orgIds, ctx);
                return toolOk({ok: true, organization: row});
            } catch (e) {
                return toolErr("delete_organization", e);
            }
        }
    );
}
