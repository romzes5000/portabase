/**
 * Portabase MCP over stdio: separate Node process with direct Drizzle access.
 * Run: pnpm mcp  (see package.json)
 */
import "./env";

import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";

import {createPortabaseMcpServer} from "@/mcp/create-mcp-server";

const server = createPortabaseMcpServer(null);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

void main().catch((err) => {
    console.error(err);
    process.exit(1);
});
