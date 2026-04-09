import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalTriggerBackup} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerTriggerBackup(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "trigger_backup",
        {
            description: "Queue a new backup for a database (status waiting).",
            inputSchema: z.object({
                organization_id: z
                    .string()
                    .optional()
                    .describe("Organization UUID for scope; omit for all accessible orgs"),
                database_id: z
                    .string()
                    .uuid()
                    .describe("`databases.id` or `agent_database_id` from agent databases.json"),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalTriggerBackup(args.database_id, scope.orgIds, ctx);
                return toolOk({ok: true, backup: row});
            } catch (e) {
                return toolErr("trigger_backup", e);
            }
        }
    );
}
