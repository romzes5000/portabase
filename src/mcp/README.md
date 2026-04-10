# Portabase MCP

[Model Context Protocol](https://modelcontextprotocol.io): общий слой **`src/lib/api/internal-queries.ts`** (Drizzle) с internal HTTP. Для **агентов** MCP и ресурс **`portabase://status`** используют **расширенный** org scope (**`organization_agents`**, **`agents.organization_id`**, плюс БД в проектах); **`GET /api/internal/agents`** по-прежнему только агенты с БД в проектах org.

## Удалённо: HTTPS + Bearer (рекомендуется для Cursor)

Эндпоинт: **`/api/mcp`** (Streamable HTTP). Заголовок **`Authorization: Bearer <API key>`** — ключ из **Organization settings → API keys** (scope **`read`**, тот же, что для **`/api/internal/*`**).

Пример **`~/.cursor/mcp.json`**:

```json
"portabase": {
  "url": "https://your-portabase.example.com/api/mcp",
  "transport": "http",
  "headers": {
    "Authorization": "Bearer pb_…"
  }
}
```

Данные **ограничены организацией ключа** (как internal HTTP API).

## Локально: stdio + `DATABASE_URL`

```bash
pnpm mcp
```

Требуется **`DATABASE_URL`** в **`.env`** (как для `pnpm dev`). Режим **без API-ключа** — полный доступ к БД; используйте только на доверенной машине.

## Cursor (stdio, macOS)

В `~/.cursor/mcp.json` задайте **`cwd`** на корень клона и либо **`pnpm`**, либо обёртку с **`PATH`**:

**macOS:** у Cursor (GUI) часто **нет** `/opt/homebrew/bin` в `PATH`, тогда `pnpm` не находится → MCP падает сразу (**Connection closed**). Обход:

```json
"portabase": {
  "command": "/bin/bash",
  "args": [
    "-lc",
    "export PATH=\"/opt/homebrew/bin:/usr/local/bin:$PATH\" && cd /absolute/path/to/this/repo && exec pnpm mcp"
  ]
}
```

Альтернатива: полный путь к **`pnpm`** и **`node`** (см. `which pnpm` / `which node` в терминале).

Не дублировать **`DATABASE_URL`** в JSON — только в **`.env`** репозитория.

## Агенты и организации

Видимость агента при **HTTP MCP** (и проверки **`get_agent_edge_key`**, **`update_agent`**, **`delete_agent`**) строится по org scope ключа: учитываются строки **`organization_agents`**, колонка **`agents.organization_id`**, а также агенты с БД в проектах этих организаций. **`create_agent`** принимает опциональный **`organization_id`** (owner/admin в org при HTTP) — как создание агента из вкладки Organization → Agents в UI.

## Идентификаторы БД в MCP

Параметры **`database_id`** / **`database_ids`** принимают либо первичный ключ **`databases.id`**, либо стабильный **`agent_database_id`** (тот же UUID, что в **`databases.json`** на стороне агента). Сервер сам приводит значение к **`databases.id`** перед обновлениями.

**Ручной smoke (после деплоя):** есть непривязанная к проекту БД с известным **`agent_database_id`** → **`create_project`** с **`database_ids: [<agent_database_id>]`** → в UI/API БД должна оказаться в проекте без SQL на хосте Portabase.

## Проверка

**Нет `DATABASE_URL`:** процесс должен завершиться с кодом **1** и сообщением про переменную:

```bash
DATABASE_URL='' pnpm mcp
```

**MCP Inspector** (нужен `.env` с валидным `DATABASE_URL`; из корня репо подхватится при `source .env` в shell):

```bash
set -a && [ -f .env ] && . ./.env && set +a
npx @modelcontextprotocol/inspector@latest --cli --transport stdio --method tools/list pnpm mcp
npx @modelcontextprotocol/inspector@latest --cli --transport stdio --method tools/call --tool-name get_backup_status pnpm mcp
npx @modelcontextprotocol/inspector@latest --cli --transport stdio --method resources/list pnpm mcp
npx @modelcontextprotocol/inspector@latest --cli --transport stdio --method resources/read --uri 'portabase://status' pnpm mcp
```

Ожидаемо: список tools (в т.ч. **`get_agent_edge_key`** при scope **`write`**), ресурс **`portabase://status`**, вызовы возвращают JSON с **`ok: true`**.

Smoke (после деплоя с write-ключом): **`tools/call`** `get_agent_edge_key` с валидным **`agent_id`** — **`edge_key`** (base64) или **`null`**, если master key в контейнере недоступен.

## Docker (production image)

В `docker/dockerfile/Dockerfile` в финальный образ копируется только **`src/db`**, не весь **`src/`**. Запуск **`pnpm mcp`** внутри контейнера из коробки **не предусмотрен** — используйте MCP с рабочей машины (клон репо + `DATABASE_URL` на dev/stage БД) или расширьте Dockerfile (копия **`src/`** или отдельный бандл).
