import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalSetAlertPolicies} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

const eventKind = z.enum([
    "error_backup",
    "error_restore",
    "success_restore",
    "success_backup",
    "weekly_report",
    "error_health_database",
]);

export const alertPolicyItemSchema = z
    .object({
        channel_id: z.string().uuid().optional(),
        notification_channel_id: z.string().uuid().optional(),
        event_kinds: z.array(eventKind).optional(),
        enabled: z.boolean().optional(),
    })
    .refine(
        (p) => p.notification_channel_id != null || p.channel_id != null,
        "Each policy must set notification_channel_id (or legacy channel_id): a notification channel id from list_notification_channels, not a storage channel id."
    );

export function registerSetAlertPolicies(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "set_alert_policies",
        {
            description:
                "Replaces all existing alert policies for this database with the given list (delete + insert). Each policy references a notification channel id (from list_notification_channels), not a storage channel id. Legacy field channel_id is accepted as an alias for notification_channel_id.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                database_id: z.string().uuid(),
                policies: z.array(alertPolicyItemSchema),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                await internalSetAlertPolicies(
                    args.database_id,
                    args.policies.map((p) => ({
                        channelId: p.notification_channel_id ?? p.channel_id!,
                        eventKinds: p.event_kinds,
                        enabled: p.enabled,
                    })),
                    scope.orgIds,
                    ctx
                );
                return toolOk({ok: true});
            } catch (e) {
                return toolErr("set_alert_policies", e);
            }
        }
    );
}
