import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalSetStoragePolicies} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerSetStoragePolicies(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "set_storage_policies",
        {
            description:
                "Replaces all existing storage policies for this database with the given list (delete + insert). Each policy uses a storage channel id from list_storage_channels, not a notification channel id.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                database_id: z
                    .string()
                    .uuid()
                    .describe("`databases.id` or `agent_database_id` from agent databases.json"),
                policies: z.array(
                    z.object({
                        channel_id: z.string().uuid(),
                        enabled: z.boolean().optional(),
                    })
                ),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                await internalSetStoragePolicies(
                    args.database_id,
                    args.policies.map((p) => ({channelId: p.channel_id, enabled: p.enabled})),
                    scope.orgIds,
                    ctx
                );
                return toolOk({ok: true});
            } catch (e) {
                return toolErr("set_storage_policies", e);
            }
        }
    );
}
