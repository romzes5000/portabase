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

export function registerSetAlertPolicies(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "set_alert_policies",
        {
            description: "Replace all alert policies for a database with the given list.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                database_id: z.string().uuid(),
                policies: z.array(
                    z.object({
                        channel_id: z.string().uuid(),
                        event_kinds: z.array(eventKind).optional(),
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
                await internalSetAlertPolicies(
                    args.database_id,
                    args.policies.map((p) => ({
                        channelId: p.channel_id,
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
