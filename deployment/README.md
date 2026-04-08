# portabase-deploy — CI/CD для форка Portabase

Репозиторий **[Oxem-Studio/portabase-deploy](https://github.com/Oxem-Studio/portabase-deploy)** (организация **Oxem-Studio**): сборка Docker-образа из [форка](https://github.com/romzes5000/portabase) и опциональный **выкат по SSH**.

## Сборка (GHCR)

1. **Actions** → **Build Portabase from fork** → **Run workflow**.
2. `ref` — полный **SHA** или **тег** на форке `romzes5000/portabase`.
3. `image_tag` — опционально; иначе для SHA берётся короткий префикс.
4. `deploy_to_server` — включите только если настроены секреты деплоя (см. ниже).

Образ: `ghcr.io/oxem-studio/portabase:<tag>` (namespace GHCR = org в нижнем регистре).

Политика веток: [fork-workflow в portabase](https://github.com/romzes5000/portabase/blob/main/docs/fork-workflow.md).

## Runners (GitHub-hosted vs self-hosted)

По умолчанию **`use_self_hosted: true`** — job’ы идут на **self-hosted runner организации Oxem-Studio** (как [neurosales](https://github.com/Oxem-Studio/neurosales-next-app)). Если нужна сборка на GitHub без своего runner’а, отключите этот input (тогда `ubuntu-latest`).

Если runner в org имеет **дополнительные метки** и не подхватывает job с одним `self-hosted`, в [build-and-deploy.yml](.github/workflows/build-and-deploy.yml) замените `runs-on` на `runs-on: [self-hosted, <ваша-метка>]`.

## Кэш сборки (GHA)

В workflow: `cache-from` / `cache-to: type=gha,mode=max` — максимальный reuse слоёв Docker. Если узкое место — **долгий upload кэша** в Actions, можно временно переключить на `mode=min` в [build-and-deploy.yml](.github/workflows/build-and-deploy.yml) (меньше объёма записи, чуть ниже hit-rate).

На **self-hosted** runner с постоянным диском дополнительно можно настроить локальный BuildKit cache (`type=local`) в конфигурации хоста — слои переживут очистку GHA cache.

### Что уже сделано в workflow и образе

| Область | Изменение |
|--------|-----------|
| Checkout | `fetch-depth: 1` + `fetch-tags: true` — меньше трафика Git, теги в `ref` по-прежнему работают |
| Параллельные запуски | `concurrency` + `cancel-in-progress` — новый dispatch отменяет предыдущий на ту же ref |
| Таймауты | `build`: 60 мин, `deploy`: 10 мин |
| Node для JS actions | `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` |
| Actions | `actions/checkout@v6`; build-push: `provenance: false`, `sbom: false` |
| Dockerfile (в форке приложения) | tusd с [GitHub Releases](https://github.com/tus/tusd/releases) вместо `git clone` + `go build`; BuildKit `--mount=type=cache` для pnpm store и `.next/cache` |

Сборка в CI использует **тот же** [`docker/dockerfile/Dockerfile`](https://github.com/romzes5000/portabase/blob/main/docker/dockerfile/Dockerfile) из checkout’а форка по полю `ref`.

## Секреты (GitHub → Settings → Secrets)

| Секрет | Назначение |
|--------|------------|
| `DEPLOY_HOST` | IP или hostname сервера |
| `DEPLOY_USER` | SSH-пользователь (например `deploy`) |
| `DEPLOY_SSH_KEY` | Приватный ключ (PEM), **без** passphrase для CI |
| `GHCR_PULL_TOKEN` | (рекомендуется) PAT или `gh auth token` для `docker login ghcr.io` на сервере, если пакет приватный |

Опционально: `FORK_READ_TOKEN` в workflow checkout — только если форк приложения станет приватным.

На сервере compose должен ссылаться на `ghcr.io/oxem-studio/portabase:${IMAGE_TAG}` — см. [server/docker-compose.ghcr.yml](server/docker-compose.ghcr.yml).

### Приватный пакет GHCR

Если образ в GHCR **не public**, на сервере перед `docker pull` нужен `docker login ghcr.io`. Добавьте на сервер в cron или вручную один раз:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u USERNAME --password-stdin
```

либо расширьте шаг `script` в workflow (храните PAT в `secrets.DEPLOY_GHCR_TOKEN` и не логируйте его).

## Деплой на сервер

CI после `docker pull` выполняет:

```bash
echo "IMAGE_TAG=<тот же тег что в GHCR>" > /opt/portabase/.env.deploy
docker compose --env-file /opt/portabase/.env.deploy -f /opt/portabase/docker-compose.yml up -d
```

**Подготовка один раз:**

1. На сервере: `sudo mkdir -p /opt/portabase`
2. Положите compose-файл, например из [server/docker-compose.example.yml](server/docker-compose.example.yml):

   ```bash
   sudo cp docker-compose.example.yml /opt/portabase/docker-compose.yml
   # отредактируйте порты, volumes, env
   ```

3. В `docker-compose.yml` образ должен быть в виде  
   `image: ghcr.io/oxem-studio/portabase:${IMAGE_TAG}`  
   — так тег из `.env.deploy` совпадает с тем, что собрал CI.

4. Убедитесь, что пользователь SSH входит в группу `docker` **или** используйте root (не рекомендуется; лучше `docker` + `usermod -aG docker deploy`).

Путь `/opt/portabase` и имя файла зашиты в [`.github/workflows/build-and-deploy.yml`](.github/workflows/build-and-deploy.yml); при другом пути измените workflow.

## Локальная отладка pull

```bash
docker pull ghcr.io/oxem-studio/portabase:<tag>
```
