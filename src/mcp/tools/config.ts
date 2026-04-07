import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import {toolErr, toolOk} from "@/mcp/json";

/** Same payload as GET /api/config (public metadata). */
export function registerPortabaseApiConfig(server: McpServer): void {
    server.registerTool(
        "portabase_api_config",
        {
            description: "GET /api/config from Portabase (public project metadata from env).",
            annotations: {readOnlyHint: true},
        },
        async () => {
            try {
                const config = {
                    PROJECT_URL: process.env.PROJECT_URL ?? null,
                    PROJECT_NAME: process.env.PROJECT_NAME ?? null,
                    PROJECT_DESCRIPTION: process.env.PROJECT_DESCRIPTION ?? null,
                };
                return toolOk({ok: true, config});
            } catch (e) {
                return toolErr("portabase_api_config", e);
            }
        }
    );
}
