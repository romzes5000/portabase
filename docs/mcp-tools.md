# MCP tools (Oxem fork)

HTTP and stdio MCP share the same tool names. Scopes come from the API key (`read` / `write` / `admin`). Stdio mode (`ctx === null`) can omit org filtering when the server runs with full DB access.

## Notification vs storage channel IDs

- **Notification** channels (Slack, SMTP, Telegram, …) are listed by `list_notification_channels`. Use these UUIDs in **`set_alert_policies`** as `notification_channel_id` (legacy alias: `channel_id`).
- **Storage** channels (S3, local, …) are listed by `list_storage_channels`. Use these UUIDs in **`set_storage_policies`** as `channel_id`.

`set_alert_policies` and `set_storage_policies` **replace all** policies for the database (delete existing rows, then insert the new list). Use **`get_database_policies`** to read the current state before changing it.

## Tool list

| Tool | Scope | Purpose |
|------|-------|---------|
| `list_agents` | read | List backup agents |
| `list_databases` | read | Databases and projects |
| `list_backups` | read | Backup history |
| `list_projects` | read | Projects |
| `list_organizations` | read | Organizations |
| `get_backup_status` | read | Backup health summary |
| `list_storage_channels` | read | Storage channels (redacted config) |
| `list_notification_channels` | read | Notification channels (redacted config) |
| `get_database_policies` | read | Current alert + storage policies for one `database_id` |
| `portabase_api_config` | read | Server URL / hints |
| `trigger_backup` | write | Start a backup |
| `create_project` / `update_project` | write | Projects |
| `create_agent` / `update_agent` | write | Agents |
| `update_database` | write | Database metadata |
| `assign_database_project` | write | Link DB to project |
| `set_backup_schedule` | write | Cron schedule |
| `set_retention_policy` | write | Retention |
| `set_alert_policies` | write | Replace alert policies |
| `set_storage_policies` | write | Replace storage policies |
| `delete_project` | admin | Archive project |
| `delete_agent` | admin | Remove agent |
| `create_organization` / `update_organization` / `delete_organization` | admin | Orgs |
| `create_storage_channel` / `update_storage_channel` / `delete_storage_channel` | admin | Storage channels |

## Error payload

Failed tools return JSON: `{ "ok": false, "operation": "<tool>", "error": "<message>" }`.

Optional `code` (non-breaking for clients that only read `error`):

- `org_access_denied` — API key cannot use the requested organization.
- `org_role_denied` — member but not owner/admin where required.

See also: [fork-workflow.md](./fork-workflow.md).
