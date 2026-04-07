import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {internalGetBackupStatus} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgForTool} from "@/mcp/org-scope";

export function registerGetBackupStatus(
    server: McpServer,
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): void {
    server.registerTool(
        "get_backup_status",
        {
            description:
                "Aggregate backup health: totals, databases without success, stale last success (INTERNAL_API_STALE_BACKUP_HOURS on server), backups in last 24h.",
            annotations: {readOnlyHint: true},
        },
        async () => {
            try {
                const orgId = resolveOrgForTool(apiKey, null);
                const status = await internalGetBackupStatus(orgId);
                return toolOk({ok: true, status});
            } catch (e) {
                return toolErr("get_backup_status", e);
            }
        }
    );
}
