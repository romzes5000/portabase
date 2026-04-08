# portabase-deploy — CI/CD для форка Portabase

Репозиторий **[Oxem-Studio/portabase-deploy](https://github.com/Oxem-Studio/portabase-deploy)** (организация **Oxem-Studio**): сборка Docker-образа из [форка](https://github.com/romzes5000/portabase) и опциональный **выкат по SSH**.

## Сборка (GHCR)

1. **Actions** → **Build Portabase from fork** → **Run workflow**.
2. `ref` — полный **SHA**, **имя ветки** или **тег** на форке `romzes5000/portabase`. Для выката «как у Oxem» удобно указывать ветку **`oxem/deploy`** (в неё вливается то, что должно уехать на сервер, без обязательного merge в `main` форка). **Автодеплой при push** в `oxem/deploy` настроен в форке (workflow **Dispatch Oxem deploy**, секрет `OXEM_DEPLOY_WORKFLOW_DISPATCH_TOKEN` — см. [docs/fork-workflow.md](https://github.com/romzes5000/portabase/blob/main/docs/fork-workflow.md)).
3. `image_tag` — опционально; иначе для SHA берётся короткий префикс.
4. `deploy_to_server` — включите только если настроены секреты деплоя (см. ниже).

Образ: `ghcr.io/oxem-studio/portabase:<tag>` (namespace GHCR = org в нижнем регистре).

Политика веток: [fork-workflow в portabase](https://github.com/romzes5000/portabase/blob/main/docs/fork-workflow.md).

## Runners (GitHub-hosted vs self-hosted)

По умолчанию **`use_self_hosted: true`** — job’ы идут на **self-hosted runner организации Oxem-Studio** (как [neurosales](https://github.com/Oxem-Studio/neurosales-next-app)). Если нужна сборка на GitHub без своего runner’а, отключите этот input (тогда `ubuntu-latest`).

Если runner в org имеет **дополнительные метки** и не подхватывает job с одним `self-hosted`, в [build-and-deploy.yml](.github/workflows/build-and-deploy.yml) замените `runs-on` на `runs-on: [self-hosted, <ваша-метка>]`.

## Кэш сборки (BuildKit)

BuildKit-кэш пишется в **GHCR** под тегом **`buildcache`** (тот же пакет `ghcr.io/oxem-studio/portabase`, отдельный манифест). Раньше использовался **GitHub Actions Cache** (`type=gha`); экспорт туда после успешного `docker push` иногда падал с ошибкой Azure/HTML 400 — из-за этого весь job помечался failed, хотя образ уже был в registry.

На **self-hosted** при желании можно дополнительно настроить локальный BuildKit cache (`type=local`) на машине runner.

### Что уже сделано в workflow и образе

| Область | Изменение |
|--------|-----------|
| Checkout | `fetch-depth: 1` + `fetch-tags: true` — меньше трафика Git, теги в `ref` по-прежнему работают |
| Параллельные запуски | `concurrency` + `cancel-in-progress` — новый dispatch отменяет предыдущий на ту же ref |
| Таймауты | `build`: 60 мин, `deploy`: 10 мин |
| Node для JS actions | `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` |
| Actions | `actions/checkout@v6`; build-push: `provenance: false`, `sbom: false` |
| BuildKit cache | Запись в **GHCR** (`:buildcache`), не в API Actions Cache — иначе при сбое экспорта кэша job падал после успешного push образа |
| Dockerfile (в форке приложения) | tusd с [GitHub Releases](https://github.com/tus/tusd/releases) вместо `git clone` + `go build`; BuildKit `--mount=type=cache` для pnpm store и `.next/cache` |

Сборка в CI использует **тот же** [`docker/dockerfile/Dockerfile`](https://github.com/romzes5000/portabase/blob/main/docker/dockerfile/Dockerfile) из checkout’а форка по полю `ref`.

## Секреты (GitHub → Settings → Secrets)

| Секрет | Назначение |
|--------|------------|
| `DEPLOY_HOST` | IP или hostname сервера |
| `DEPLOY_USER` | SSH-пользователь (например `deploy`) |
| `DEPLOY_SSH_KEY` | Приватный ключ (PEM), **без** passphrase для CI |
| `GHCR_PULL_TOKEN` | **Часто нужен при 403 на `docker pull`:** PAT с **`read:packages`** (classic) или fine-grained с доступом к пакетам org **Oxem-Studio**. Job **deploy** по умолчанию использует **`GITHUB_TOKEN`**, но у GHCR пакет может быть без доступа для репозитория **portabase-deploy** — тогда без PAT манифест отдаёт **403** даже после успешного `docker login` |
| `GHCR_PULL_LOGIN` | Не обязателен. Если задан `GHCR_PULL_TOKEN`, логин на GHCR: по умолчанию **`x-access-token`** (подходит для classic PAT); при необходимости укажите владельца PAT (GitHub username) |

Опционально: `FORK_READ_TOKEN` в workflow checkout — только если форк приложения станет приватным.

### SSH: хост и ключ

- **`DEPLOY_HOST`**: self-hosted runner в сети Oxem **NetBird** обычно ходит на сервер по **mesh-IP** (например `100.72.173.25`). Публичный IP (`159.194.…`) с runner может быть закрыт firewall / не отвечать по SSH — тогда в логах не `publickey`, а `Connection closed` или таймаут.
- **`DEPLOY_SSH_KEY`**: приватный ключ обязан совпадать с одной из строк в `deploy:~/.ssh/authorized_keys`. Иначе: `ssh: unable to authenticate, attempted methods [none publickey]`. Добавить ключ: с рабочей машины, где уже есть доступ, выполнить `ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@<host>` или вручную дописать **публичный** ключ в `authorized_keys`.

На сервере compose должен ссылаться на `ghcr.io/oxem-studio/portabase:${IMAGE_TAG}` — см. [server/docker-compose.ghcr.yml](server/docker-compose.ghcr.yml).

### Приватный пакет GHCR

Workflow логинится на сервере через **`GITHUB_TOKEN`** (`permissions: packages: read`) или через секрет **`GHCR_PULL_TOKEN`**, если он задан (приоритет у секрета).

**403 на `docker pull` после успешного login** обычно значит: токен не может читать манифест пакета. Варианты:

1. **Рекомендуется:** создать [classic PAT](https://github.com/settings/tokens) с **`read:packages`**, добавить в **Secrets** репозитория `GHCR_PULL_TOKEN`, при необходимости — `GHCR_PULL_LOGIN` (см. таблицу выше).
2. В **GitHub** → **Packages** → пакет `portabase` → **Package settings** → **Manage Actions access** — выдать репозиторию **Oxem-Studio/portabase-deploy** роль **Read** (или **Write**), чтобы **`GITHUB_TOKEN`** этого репо мог делать `docker pull` без PAT.
3. Сделать пакет **public** в настройках пакета (если допустимо по политике).

Проверка вручную: `echo "$PAT" | docker login ghcr.io -u x-access-token --password-stdin` и затем `docker pull ghcr.io/oxem-studio/portabase:<tag>`.

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
