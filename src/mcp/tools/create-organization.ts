import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalCreateOrganization} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";

export function registerCreateOrganization(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "create_organization",
        {
            description:
                "Create a new organization and add the API key owner as owner member. Requires HTTP MCP (API key with user).",
            inputSchema: z.object({
                name: z.string().min(5).max(40),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                if (!ctx?.userId) {
                    return toolErr(
                        "create_organization",
                        new Error("create_organization requires HTTP MCP with an API key tied to a user")
                    );
                }
                const row = await internalCreateOrganization(args.name, ctx.userId, null, ctx);
                return toolOk({ok: true, organization: row});
            } catch (e) {
                return toolErr("create_organization", e);
            }
        }
    );
}
