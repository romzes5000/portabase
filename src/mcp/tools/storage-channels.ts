import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {internalListStorageChannels} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgForTool} from "@/mcp/org-scope";

export function registerListStorageChannels(
    server: McpServer,
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): void {
    server.registerTool(
        "list_storage_channels",
        {
            description: "S3 storage channels with redacted credentials and total backup bytes per channel.",
            annotations: {readOnlyHint: true},
        },
        async () => {
            try {
                const orgId = resolveOrgForTool(apiKey, null);
                const rows = await internalListStorageChannels(orgId);
                return toolOk({ok: true, storage_channels: rows});
            } catch (e) {
                return toolErr("list_storage_channels", e);
            }
        }
    );
}
