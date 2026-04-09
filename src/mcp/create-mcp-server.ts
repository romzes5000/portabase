import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {McpContext} from "@/lib/api/internal-auth";
import {registerStatusResource} from "@/mcp/resources/status";
import {registerAllTools} from "@/mcp/tools";

/**
 * @param ctx — null для stdio (полный доступ); для HTTP — контекст из `loadMcpContext` после `verifyApiKeyRequest`.
 */
export function createPortabaseMcpServer(ctx: McpContext | null): McpServer {
    const server = new McpServer({
        name: "portabase-mcp",
        version: "0.3.0",
    });
    registerAllTools(server, ctx);
    registerStatusResource(server, ctx);
    return server;
}
