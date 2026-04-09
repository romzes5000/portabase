import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalUpdateStorageChannel} from "@/lib/api/internal-mutations";
import {redactStorageConfig} from "@/lib/api/redact-storage-config";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerUpdateStorageChannel(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "update_storage_channel",
        {
            description:
                "Update a storage channel. Requires owner/admin in all organizations linked to the channel.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                channel_id: z.string().uuid(),
                name: z.string().optional(),
                config: z.record(z.string(), z.unknown()).optional(),
                enabled: z.boolean().optional(),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalUpdateStorageChannel(
                    args.channel_id,
                    {
                        name: args.name,
                        config: args.config as Record<string, unknown> | undefined,
                        enabled: args.enabled,
                    },
                    scope.orgIds,
                    ctx
                );
                return toolOk({
                    ok: true,
                    storage_channel: {
                        ...row,
                        config: redactStorageConfig(row.config),
                    },
                });
            } catch (e) {
                return toolErr("update_storage_channel", e);
            }
        }
    );
}
