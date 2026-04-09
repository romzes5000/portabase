import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalDeleteProject} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerDeleteProject(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "delete_project",
        {
            description: "Archive a project (soft-delete). Requires owner or admin in the project's organization.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                project_id: z.string().uuid(),
            }),
            annotations: {readOnlyHint: false, destructiveHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalDeleteProject(args.project_id, scope.orgIds, ctx);
                return toolOk({ok: true, project: row});
            } catch (e) {
                return toolErr("delete_project", e);
            }
        }
    );
}
