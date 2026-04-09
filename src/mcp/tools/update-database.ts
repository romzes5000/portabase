import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalUpdateDatabase} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerUpdateDatabase(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "update_database",
        {
            description: "Update database description (database must belong to a project in scope).",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                database_id: z
                    .string()
                    .uuid()
                    .describe("`databases.id` or `agent_database_id` from agent databases.json"),
                description: z.string(),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalUpdateDatabase(args.database_id, args.description, scope.orgIds, ctx);
                return toolOk({ok: true, database: row});
            } catch (e) {
                return toolErr("update_database", e);
            }
        }
    );
}
