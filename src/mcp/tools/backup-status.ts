import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalGetBackupStatus} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerGetBackupStatus(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "get_backup_status",
        {
            description:
                "Aggregate backup health: totals, databases without success, stale last success (INTERNAL_API_STALE_BACKUP_HOURS on server), backups in last 24h.",
            inputSchema: z.object({
                organization_id: z
                    .string()
                    .optional()
                    .describe("Organization UUID; omit for aggregate across all accessible organizations"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const status = await internalGetBackupStatus(scope.orgIds);
                return toolOk({ok: true, status});
            } catch (e) {
                return toolErr("get_backup_status", e);
            }
        }
    );
}
