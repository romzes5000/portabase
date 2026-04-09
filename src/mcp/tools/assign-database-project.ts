import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalAssignDatabaseProject} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerAssignDatabaseProject(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "assign_database_project",
        {
            description: "Set database project_id (null to unassign). Project must be in an accessible organization.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                database_id: z
                    .string()
                    .uuid()
                    .describe("`databases.id` or `agent_database_id` from agent databases.json"),
                project_id: z.string().uuid().nullable(),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalAssignDatabaseProject(
                    args.database_id,
                    args.project_id,
                    scope.orgIds,
                    ctx
                );
                return toolOk({ok: true, database: row});
            } catch (e) {
                return toolErr("assign_database_project", e);
            }
        }
    );
}
