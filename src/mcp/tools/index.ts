import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {VerifiedApiKey} from "@/lib/api/internal-auth";
import {registerGetBackupStatus} from "@/mcp/tools/backup-status";
import {registerListBackups} from "@/mcp/tools/backups";
import {registerPortabaseApiConfig} from "@/mcp/tools/config";
import {registerListDatabases} from "@/mcp/tools/databases";
import {registerListOrganizations} from "@/mcp/tools/organizations";
import {registerListProjects} from "@/mcp/tools/projects";
import {registerListAgents} from "@/mcp/tools/agents";
import {registerListStorageChannels} from "@/mcp/tools/storage-channels";

export function registerAllTools(
    server: McpServer,
    apiKey: Pick<VerifiedApiKey, "organizationId"> | null
): void {
    registerListAgents(server, apiKey);
    registerListDatabases(server, apiKey);
    registerListBackups(server, apiKey);
    registerListProjects(server, apiKey);
    registerListOrganizations(server, apiKey);
    registerGetBackupStatus(server, apiKey);
    registerListStorageChannels(server, apiKey);
    registerPortabaseApiConfig(server);
}
