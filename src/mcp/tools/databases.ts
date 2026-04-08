import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalListDatabases} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerListDatabases(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "list_databases",
        {
            description: "List databases with agent and last backup info.",
            inputSchema: z.object({
                organization_id: z
                    .string()
                    .optional()
                    .describe("Organization UUID; omit for databases across all accessible organizations"),
                agent_id: z.string().optional().describe("Filter by agent UUID (empty = all)"),
                project_id: z.string().optional().describe("Filter by project UUID (empty = all)"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const rows = await internalListDatabases(
                    scope.orgIds,
                    args.agent_id ?? "",
                    args.project_id ?? ""
                );
                return toolOk({ok: true, databases: rows});
            } catch (e) {
                return toolErr("list_databases", e);
            }
        }
    );
}
