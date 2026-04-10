import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalListAgents} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerListAgents(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "list_agents",
        {
            description:
                "List Portabase agents with last_contact and online flag (server INTERNAL_API_AGENT_ONLINE_MINUTES).",
            inputSchema: z.object({
                include_archived: z
                    .boolean()
                    .optional()
                    .describe("Include archived agents (default false)"),
                organization_id: z
                    .string()
                    .optional()
                    .describe("Organization UUID; omit for agents across all accessible organizations"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const rows = await internalListAgents(scope.orgIds, args.include_archived ?? false, true);
                return toolOk({ok: true, agents: rows});
            } catch (e) {
                return toolErr("list_agents", e);
            }
        }
    );
}
