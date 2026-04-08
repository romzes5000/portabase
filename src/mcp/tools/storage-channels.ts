import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalListStorageChannels} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerListStorageChannels(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "list_storage_channels",
        {
            description: "S3 storage channels with redacted credentials and total backup bytes per channel.",
            inputSchema: z.object({
                organization_id: z
                    .string()
                    .optional()
                    .describe("Organization UUID; omit for channels across all accessible organizations"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const rows = await internalListStorageChannels(scope.orgIds);
                return toolOk({ok: true, storage_channels: rows});
            } catch (e) {
                return toolErr("list_storage_channels", e);
            }
        }
    );
}
