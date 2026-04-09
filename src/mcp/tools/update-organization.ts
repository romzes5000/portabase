import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalUpdateOrganization} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerUpdateOrganization(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "update_organization",
        {
            description:
                "Update organization name and/or slug. Requires owner or admin in the organization.",
            inputSchema: z.object({
                organization_id: z.string().uuid(),
                name: z.string().min(1).optional(),
                slug: z.string().min(1).optional(),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const scope = resolveOrgScope(ctx, args.organization_id);
                const row = await internalUpdateOrganization(
                    args.organization_id,
                    {name: args.name, slug: args.slug},
                    scope.orgIds,
                    ctx
                );
                return toolOk({ok: true, organization: row});
            } catch (e) {
                return toolErr("update_organization", e);
            }
        }
    );
}
