import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalUpdateProject} from "@/lib/api/internal-mutations";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerUpdateProject(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "update_project",
        {
            description:
                "Update project name and/or attached database ids (same semantics as dashboard). UUIDs may be primary `databases.id` or `agent_database_id` from agent config.",
            inputSchema: z.object({
                organization_id: z
                    .string()
                    .optional()
                    .describe("Optional org hint for scope resolution"),
                project_id: z.string().uuid(),
                name: z.string().min(1),
                database_ids: z
                    .array(z.string().uuid())
                    .describe("Each UUID may be `databases.id` or `agent_database_id` from the agent databases.json"),
            }),
            annotations: {readOnlyHint: false},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const row = await internalUpdateProject(
                    args.project_id,
                    {name: args.name, databases: args.database_ids},
                    scope.orgIds,
                    ctx
                );
                return toolOk({ok: true, project: row});
            } catch (e) {
                return toolErr("update_project", e);
            }
        }
    );
}
