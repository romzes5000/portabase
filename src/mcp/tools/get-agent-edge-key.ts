import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {assertAgentIdAllowedForMcpOrgScope} from "@/lib/api/internal-queries";
import {buildEdgeKeyBase64} from "@/lib/edge-key-internal";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerGetAgentEdgeKey(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "get_agent_edge_key",
        {
            description:
                "Returns base64 edge_key for an existing agent (same bootstrap token as create_agent). Agent must be visible via databases assigned to projects in your organizations (same rules as update_agent). For brand-new agents with no DBs in org yet, use edge_key from create_agent only.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                agent_id: z.string().uuid(),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                await assertAgentIdAllowedForMcpOrgScope(args.agent_id, scope.orgIds);
                let edgeKey: string | null = null;
                try {
                    edgeKey = buildEdgeKeyBase64(args.agent_id);
                } catch {
                    edgeKey = null;
                }
                return toolOk({ok: true, agent_id: args.agent_id, edge_key: edgeKey});
            } catch (e) {
                return toolErr("get_agent_edge_key", e);
            }
        }
    );
}
