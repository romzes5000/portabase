import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalDeleteAgent} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerDeleteAgent(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "delete_agent",
        {
            description:
                "Archive an agent (soft-delete). Requires owner/admin in an organization that uses this agent via databases.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                agent_id: z.string().uuid(),
            }),
            annotations: {readOnlyHint: false, destructiveHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalDeleteAgent(args.agent_id, scope.orgIds, ctx);
                return toolOk({ok: true, agent: row});
            } catch (e) {
                return toolErr("delete_agent", e);
            }
        }
    );
}
