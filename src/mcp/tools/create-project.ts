import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalCreateProject} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerCreateProject(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "create_project",
        {
            description: "Create a project in an organization and optionally attach databases by id.",
            inputSchema: z.object({
                organization_id: z.string().uuid(),
                name: z.string().min(1),
                database_ids: z.array(z.string().uuid()).optional(),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const scope = resolveOrgScope(ctx, args.organization_id);
                const row = await internalCreateProject(
                    args.name,
                    args.organization_id,
                    args.database_ids,
                    scope.orgIds,
                    ctx
                );
                return toolOk({ok: true, project: row});
            } catch (e) {
                return toolErr("create_project", e);
            }
        }
    );
}
