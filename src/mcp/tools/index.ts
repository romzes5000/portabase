import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {McpContext} from "@/lib/api/internal-auth";
import {registerGetBackupStatus} from "@/mcp/tools/backup-status";
import {registerListBackups} from "@/mcp/tools/backups";
import {registerPortabaseApiConfig} from "@/mcp/tools/config";
import {registerListDatabases} from "@/mcp/tools/databases";
import {registerListOrganizations} from "@/mcp/tools/organizations";
import {registerListProjects} from "@/mcp/tools/projects";
import {registerListAgents} from "@/mcp/tools/agents";
import {registerListStorageChannels} from "@/mcp/tools/storage-channels";

export function registerAllTools(server: McpServer, ctx: McpContext | null): void {
    registerListAgents(server, ctx);
    registerListDatabases(server, ctx);
    registerListBackups(server, ctx);
    registerListProjects(server, ctx);
    registerListOrganizations(server, ctx);
    registerGetBackupStatus(server, ctx);
    registerListStorageChannels(server, ctx);
    registerPortabaseApiConfig(server);
}
