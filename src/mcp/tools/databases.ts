import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {internalListDatabases} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgForTool} from "@/mcp/org-scope";

export function registerListDatabases(
    server: McpServer,
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): void {
    server.registerTool(
        "list_databases",
        {
            description: "List databases with agent and last backup info.",
            inputSchema: z.object({
                agent_id: z.string().optional().describe("Filter by agent UUID (empty = all)"),
                project_id: z.string().optional().describe("Filter by project UUID (empty = all)"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const orgId = resolveOrgForTool(apiKey, null);
                const rows = await internalListDatabases(orgId, args.agent_id ?? "", args.project_id ?? "");
                return toolOk({ok: true, databases: rows});
            } catch (e) {
                return toolErr("list_databases", e);
            }
        }
    );
}
