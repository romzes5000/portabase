import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {McpContext} from "@/lib/api/internal-auth";
import {internalListProjects} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgScope} from "@/mcp/org-scope";

export function registerListProjects(server: McpServer, ctx: McpContext | null): void {
    server.registerTool(
        "list_projects",
        {
            description:
                "List projects; optional organization_id (UUID from list_organizations[].id; empty = all organizations the user can access).",
            inputSchema: z.object({
                organization_id: z
                    .string()
                    .optional()
                    .describe("Organization UUID from list_organizations[].id; empty string = all accessible organizations"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const scope = resolveOrgScope(ctx, queryOrg);
                const rows = await internalListProjects(scope.orgIds);
                return toolOk({ok: true, projects: rows});
            } catch (e) {
                return toolErr("list_projects", e);
            }
        }
    );
}
