import type {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";

import type {ApiScope, McpContext} from "@/lib/api/internal-auth";
import {registerListAgents} from "@/mcp/tools/agents";
import {registerAssignDatabaseProject} from "@/mcp/tools/assign-database-project";
import {registerGetBackupStatus} from "@/mcp/tools/backup-status";
import {registerListBackups} from "@/mcp/tools/backups";
import {registerPortabaseApiConfig} from "@/mcp/tools/config";
import {registerCreateAgent} from "@/mcp/tools/create-agent";
import {registerCreateOrganization} from "@/mcp/tools/create-organization";
import {registerCreateProject} from "@/mcp/tools/create-project";
import {registerCreateStorageChannel} from "@/mcp/tools/create-storage-channel";
import {registerListDatabases} from "@/mcp/tools/databases";
import {registerDeleteAgent} from "@/mcp/tools/delete-agent";
import {registerDeleteOrganization} from "@/mcp/tools/delete-organization";
import {registerDeleteProject} from "@/mcp/tools/delete-project";
import {registerDeleteStorageChannel} from "@/mcp/tools/delete-storage-channel";
import {registerListOrganizations} from "@/mcp/tools/organizations";
import {registerListProjects} from "@/mcp/tools/projects";
import {registerSetAlertPolicies} from "@/mcp/tools/set-alert-policies";
import {registerSetBackupSchedule} from "@/mcp/tools/set-backup-schedule";
import {registerSetRetentionPolicy} from "@/mcp/tools/set-retention-policy";
import {registerSetStoragePolicies} from "@/mcp/tools/set-storage-policies";
import {registerListStorageChannels} from "@/mcp/tools/storage-channels";
import {registerTriggerBackup} from "@/mcp/tools/trigger-backup";
import {registerUpdateAgent} from "@/mcp/tools/update-agent";
import {registerUpdateDatabase} from "@/mcp/tools/update-database";
import {registerUpdateOrganization} from "@/mcp/tools/update-organization";
import {registerUpdateProject} from "@/mcp/tools/update-project";
import {registerUpdateStorageChannel} from "@/mcp/tools/update-storage-channel";

function hasScope(ctx: McpContext | null, scope: ApiScope): boolean {
    const scopes = ctx?.scopes ?? (["read", "write", "admin"] as ApiScope[]);
    return scopes.includes(scope);
}

export function registerAllTools(server: McpServer, ctx: McpContext | null): void {
    registerListAgents(server, ctx);
    registerListDatabases(server, ctx);
    registerListBackups(server, ctx);
    registerListProjects(server, ctx);
    registerListOrganizations(server, ctx);
    registerGetBackupStatus(server, ctx);
    registerListStorageChannels(server, ctx);
    registerPortabaseApiConfig(server);

    if (hasScope(ctx, "write")) {
        registerTriggerBackup(server, ctx);
        registerCreateProject(server, ctx);
        registerUpdateProject(server, ctx);
        registerCreateAgent(server, ctx);
        registerUpdateAgent(server, ctx);
        registerUpdateDatabase(server, ctx);
        registerAssignDatabaseProject(server, ctx);
        registerSetBackupSchedule(server, ctx);
        registerSetRetentionPolicy(server, ctx);
        registerSetAlertPolicies(server, ctx);
        registerSetStoragePolicies(server, ctx);
    }

    if (hasScope(ctx, "admin")) {
        registerDeleteProject(server, ctx);
        registerDeleteAgent(server, ctx);
        registerCreateOrganization(server, ctx);
        registerUpdateOrganization(server, ctx);
        registerDeleteOrganization(server, ctx);
        registerCreateStorageChannel(server, ctx);
        registerUpdateStorageChannel(server, ctx);
        registerDeleteStorageChannel(server, ctx);
    }
}
