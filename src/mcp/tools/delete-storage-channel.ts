import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalDeleteStorageChannel} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerDeleteStorageChannel(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "delete_storage_channel",
        {
            description:
                "Delete a storage channel. Requires owner/admin in all organizations linked to the channel.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                channel_id: z.string().uuid(),
            }),
            annotations: {readOnlyHint: false, destructiveHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalDeleteStorageChannel(args.channel_id, scope.orgIds, ctx);
                return toolOk({ok: true, storage_channel: row});
            } catch (e) {
                return toolErr("delete_storage_channel", e);
            }
        }
    );
}
