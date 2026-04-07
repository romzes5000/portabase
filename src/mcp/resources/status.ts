import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {internalGetBackupStatus, internalListAgents} from "@/lib/api/internal-queries";
import {resolveOrgForTool} from "@/mcp/org-scope";

export function registerStatusResource(
    server: McpServer,
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): void {
    server.registerResource(
        "portabase_status",
        "portabase://status",
        {
            description: "Aggregated agents online/offline and backup health (Drizzle, same data as internal API).",
            mimeType: "application/json",
        },
        async (uri) => {
            const orgId = resolveOrgForTool(apiKey, null);
            const agents = await internalListAgents(orgId, false);
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
            const health = await internalGetBackupStatus(orgId);
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
