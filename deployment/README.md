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
| `GHCR_PULL_TOKEN` | Не обязателен: job **deploy** передаёт на сервер **`GITHUB_TOKEN`** (`packages: read`) — тем же токеном, что пушит образ в **build**. Отдельный PAT нужен только если уберёте эту схему или потребуется внешний pull |

Опционально: `FORK_READ_TOKEN` в workflow checkout — только если форк приложения станет приватным.

### SSH: хост и ключ

- **`DEPLOY_HOST`**: self-hosted runner в сети Oxem **NetBird** обычно ходит на сервер по **mesh-IP** (например `100.72.173.25`). Публичный IP (`159.194.…`) с runner может быть закрыт firewall / не отвечать по SSH — тогда в логах не `publickey`, а `Connection closed` или таймаут.
- **`DEPLOY_SSH_KEY`**: приватный ключ обязан совпадать с одной из строк в `deploy:~/.ssh/authorized_keys`. Иначе: `ssh: unable to authenticate, attempted methods [none publickey]`. Добавить ключ: с рабочей машины, где уже есть доступ, выполнить `ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@<host>` или вручную дописать **публичный** ключ в `authorized_keys`.

На сервере compose должен ссылаться на `ghcr.io/oxem-studio/portabase:${IMAGE_TAG}` — см. [server/docker-compose.ghcr.yml](server/docker-compose.ghcr.yml).

### Приватный пакет GHCR

Workflow сам логинится на `ghcr.io` на сервере через **`GITHUB_TOKEN`** job’а deploy (в workflow задано `permissions: packages: read`). Это тот же org/repo-токен, что и у шага push в **build**, поэтому отдельный PAT для pull обычно **не нужен**.

Если по какой-то причине используете **другой** токен/PAT и видите **`403 Forbidden`** на `docker pull` при успешном `docker login`: у токена должны быть **`read:packages`** и доступ к org-пакету; либо сделайте пакет **public** в настройках GitHub Packages.

Проверка вручную: `echo "$PAT" | docker login ghcr.io -u USERNAME --password-stdin` и затем `docker pull ghcr.io/oxem-studio/portabase:<tag>`.

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
