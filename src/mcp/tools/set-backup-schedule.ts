import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalSetBackupSchedule} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerSetBackupSchedule(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "set_backup_schedule",
        {
            description: "Set database backup cron string (empty string clears schedule and retention policy).",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                database_id: z
                    .string()
                    .uuid()
                    .describe("`databases.id` or `agent_database_id` from agent databases.json"),
                cron: z.string().describe("Cron expression or empty string to disable"),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalSetBackupSchedule(args.database_id, args.cron, scope.orgIds, ctx);
                return toolOk({ok: true, database: row});
            } catch (e) {
                return toolErr("set_backup_schedule", e);
            }
        }
    );
}
