import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalCreateStorageChannel} from "@/lib/api/internal-mutations";
import {redactStorageConfig} from "@/lib/api/redact-storage-config";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerCreateStorageChannel(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "create_storage_channel",
        {
            description:
                "Create a storage channel (S3/local/google-drive). For HTTP MCP, organization_id is required. Requires owner/admin in that org.",
            inputSchema: z.object({
                organization_id: z.string().uuid().optional(),
                provider: z.enum(["local", "s3", "google-drive"]),
                name: z.string().min(1).max(255),
                config: z.record(z.string(), z.unknown()),
                enabled: z.boolean().optional().default(true),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalCreateStorageChannel(
                    args.organization_id,
                    args.provider,
                    args.name,
                    args.config as Record<string, unknown>,
                    args.enabled ?? true,
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
                return toolErr("create_storage_channel", e);
            }
        }
    );
}
