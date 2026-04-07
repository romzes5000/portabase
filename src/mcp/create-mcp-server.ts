import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {registerStatusResource} from "@/mcp/resources/status";
import {registerAllTools} from "@/mcp/tools";

/**
 * @param apiKey — null для stdio (полный доступ); для HTTP — проверенный ключ из `verifyApiKeyRequest`.
 */
export function createPortabaseMcpServer(
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): McpServer {
    const server = new McpServer({
        name: "portabase-mcp",
        version: "0.2.0",
    });
    registerAllTools(server, apiKey);
    registerStatusResource(server, apiKey);
    return server;
}
