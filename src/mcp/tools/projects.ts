import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {internalListProjects} from "@/lib/api/internal-queries";
import {toolErr, toolOk} from "@/mcp/json";
import {resolveOrgForTool} from "@/mcp/org-scope";

export function registerListProjects(
    server: McpServer,
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): void {
    server.registerTool(
        "list_projects",
        {
            description:
                "List projects; optional organization_id (UUID from list_organizations[].id; empty = all organizations).",
            inputSchema: z.object({
                organization_id: z
                    .string()
                    .optional()
                    .describe("Organization UUID from list_organizations[].id; empty string = all organizations"),
            }),
            annotations: {readOnlyHint: true},
        },
        async (args) => {
            try {
                const queryOrg = args.organization_id?.trim() || null;
                const orgId = resolveOrgForTool(apiKey, queryOrg);
                const rows = await internalListProjects(orgId);
                return toolOk({ok: true, projects: rows});
            } catch (e) {
                return toolErr("list_projects", e);
            }
        }
    );
}
