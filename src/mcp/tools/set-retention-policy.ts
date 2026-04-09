import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalSetRetentionPolicy} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

const gfsSchema = z.object({
    daily: z.number().min(1).max(31),
    weekly: z.number().min(0).max(52),
    monthly: z.number().min(0).max(120),
    yearly: z.number().min(0).max(50),
});

export function registerSetRetentionPolicy(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "set_retention_policy",
        {
            description: "Create or update retention policy for a database.",
            inputSchema: z.object({
                organization_id: z.string().optional().describe("Optional org hint for scope"),
                database_id: z
                    .string()
                    .uuid()
                    .describe("`databases.id` or `agent_database_id` from agent databases.json"),
                type: z.enum(["count", "days", "gfs"]),
                count: z.number().optional(),
                days: z.number().optional(),
                gfs: gfsSchema.optional(),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalSetRetentionPolicy(
                    args.database_id,
                    {
                        type: args.type,
                        count: args.count,
                        days: args.days,
                        gfsDaily: args.gfs?.daily,
                        gfsWeekly: args.gfs?.weekly,
                        gfsMonthly: args.gfs?.monthly,
                        gfsYearly: args.gfs?.yearly,
                    },
                    scope.orgIds,
                    ctx
                );
                return toolOk({ok: true, retention_policy: row});
            } catch (e) {
                return toolErr("set_retention_policy", e);
            }
        }
    );
}
