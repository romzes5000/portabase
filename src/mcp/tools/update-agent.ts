import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalUpdateAgent} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerUpdateAgent(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "update_agent",
        {
            description: "Update agent name and description (scoped to orgs via linked databases).",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                agent_id: z.string().uuid(),
                name: z.string().min(1),
                description: z.string().optional().default(""),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalUpdateAgent(
                    args.agent_id,
                    {name: args.name, description: args.description ?? ""},
                    scope.orgIds,
                    ctx
                );
                return toolOk({ok: true, agent: row});
            } catch (e) {
                return toolErr("update_agent", e);
            }
        }
    );
}
