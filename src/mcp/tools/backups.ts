import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalListBackups} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerListBackups(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "list_backups",
        {
            description: "List backup rows with pagination.",
            inputSchema: z.object({
                organization_id: z
                    .string()
                    .optional()
                    .describe("Organization UUID; omit for backups across all accessible organizations"),
                database_id: z.string().optional().describe("Filter by database UUID"),
                status: z
                    .string()
                    .optional()
                    .describe("Filter: waiting | ongoing | failed | success"),
                limit: z.number().optional().describe("Page size (default 100, max 500)"),
                offset: z.number().optional().describe("Offset for pagination"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const limit = args.limit ?? 100;
                const offset = args.offset ?? 0;
                const rows = await internalListBackups(
                    scope.orgIds,
                    args.database_id ?? "",
                    args.status ?? "",
                    limit,
                    offset
                );
                return toolOk({ok: true, backups: rows});
            } catch (e) {
                return toolErr("list_backups", e);
            }
        }
    );
}
