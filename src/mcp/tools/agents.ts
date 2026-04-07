import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {internalListAgents} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgForTool} from "@/mcp/org-scope";

export function registerListAgents(
    server: McpServer,
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): void {
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
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const orgId = resolveOrgForTool(apiKey, null);
                const rows = await internalListAgents(orgId, args.include_archived ?? false);
                return toolOk({ok: true, agents: rows});
            } catch (e) {
                return toolErr("list_agents", e);
            }
        }
    );
}
