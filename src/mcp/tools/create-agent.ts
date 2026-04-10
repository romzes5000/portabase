import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalCreateAgent} from "@/lib/api/internal-mutations";
import {buildEdgeKeyBase64} from "@/lib/edge-key-internal";
import {toolErr, toolOk} from "@/mcp/json";

export function registerCreateAgent(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "create_agent",
        {
            description:
                "Register a new Portabase agent. Returns edge_key (base64) for agent bootstrap when master key is available.",
            inputSchema: z.object({
                name: z.string().min(1),
                description: z.string().optional().default(""),
                organization_id: z
                    .string()
                    .uuid()
                    .optional()
                    .describe(
                        "Optional organization UUID: links the agent to that org (organization_agents + agents.organization_id), same as UI. HTTP MCP requires owner/admin in that org."
                    ),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const orgId = args.organization_id?.trim() || null;
                const row = await internalCreateAgent(
                    args.name,
                    args.description ?? "",
                    orgId,
                    ctx
                );
                let edgeKey: string | null = null;
                try {
                    edgeKey = buildEdgeKeyBase64(row.id);
                } catch {
                    edgeKey = null;
                }
                return toolOk({ok: true, agent: row, edge_key: edgeKey});
            } catch (e) {
                return toolErr("create_agent", e);
            }
        }
    );
}
