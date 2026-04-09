import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalListNotificationChannels} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerListNotificationChannels(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "list_notification_channels",
        {
            description:
                "Lists notification channels (Slack, SMTP, Telegram, etc.) with redacted config. IDs here are for set_alert_policies — not storage channel IDs.",
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
                const rows = await internalListNotificationChannels(scope.orgIds);
                return toolOk({ok: true, notification_channels: rows});
            } catch (e) {
                return toolErr("list_notification_channels", e);
            }
        }
    );
}
