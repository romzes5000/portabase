import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalGetDatabasePolicies} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerGetDatabasePolicies(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "get_database_policies",
        {
            description:
                "Read current alert and storage policies for one database (before calling set_alert_policies / set_storage_policies, which replace all policies).",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                database_id: z
                    .string()
                    .uuid()
                    .describe("`databases.id` or `agent_database_id` from agent databases.json"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const data = await internalGetDatabasePolicies(args.database_id, scope.orgIds, ctx);
                return toolOk({ok: true, ...data});
            } catch (e) {
                return toolErr("get_database_policies", e);
            }
        }
    );
}
