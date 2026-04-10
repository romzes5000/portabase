import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalGetBackupStatus, internalListAgents} from "@/lib/api/internal-queries";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerStatusResource(server: McpServer, ctx: McpContext | null): void {
    server.registerResource(
        "portabase_status",
        "portabase://status",
        {
            description: "Aggregated agents online/offline and backup health (Drizzle, same data as internal API).",
            mimeType: "application/json",
        },
        async (uri) => {
            const scope = resolveOrgScope(ctx, null);
            const agents = await internalListAgents(scope.orgIds, false, true);
            let online = 0;
            let offline = 0;
            for (const row of agents) {
                const m = row as Record<string, unknown>;
                if (m.online === true) {
                    online++;
                } else {
                    offline++;
                }
            }
            const health = await internalGetBackupStatus(scope.orgIds);
            const snapshot = {
                agents_total: agents.length,
                agents_online: online,
                agents_offline: offline,
                backup_health: health,
            };
            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: "application/json",
                        text: JSON.stringify(snapshot, null, 2),
                    },
                ],
            };
        }
    );
}
