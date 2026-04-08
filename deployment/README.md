# portabase-deploy — CI/CD для форка Portabase

Репозиторий **[romzes5000/portabase-deploy](https://github.com/romzes5000/portabase-deploy)** (приватный): сборка Docker-образа из [форка](https://github.com/romzes5000/portabase) и опциональный **выкат по SSH**.

## Сборка (GHCR)

1. **Actions** → **Build Portabase from fork** → **Run workflow**.
2. `ref` — полный **SHA** или **тег** на форке.
3. `image_tag` — опционально; иначе для SHA берётся короткий префикс.
4. `deploy_to_server` — включите только если настроены секреты деплоя (см. ниже).

Образ: `ghcr.io/romzes5000/portabase:<tag>`.

Политика веток: [fork-workflow в portabase](https://github.com/romzes5000/portabase/blob/main/docs/fork-workflow.md).

## Self-hosted runner

Workflow **Build Portabase from fork** использует `runs-on: self-hosted`, по тому же принципу, что [Validation / Deploy SSH в neurosales](https://github.com/Oxem-Studio/neurosales-next-app) (Oxem-Studio).

**Что нужно:**

1. Зарегистрировать runner для этого репозитория или для организации/аккаунта: **Settings → Actions → Runners → New self-hosted runner** (инструкция GitHub для Linux/macOS/Windows).
2. На машине runner’а: установлен **Docker** и **Docker Buildx** (как на типичном CI-хосте), сеть до `ghcr.io` и при необходимости до SSH-хоста деплоя.
3. Если у вас несколько self-hosted машин, задайте **общие метки** (`self-hosted`, `Linux`, `X64`) и при необходимости поменяйте в workflow на `runs-on: [self-hosted, oxem, ...]` под ваши labels.

Пока runner не подключён, job’ы будут ждать в очереди.

## Секреты (GitHub → Settings → Secrets)

| Секрет | Назначение |
|--------|------------|
| `DEPLOY_HOST` | IP или hostname сервера |
| `DEPLOY_USER` | SSH-пользователь (например `deploy`) |
| `DEPLOY_SSH_KEY` | Приватный ключ (PEM), **без** passphrase для CI |

Опционально: `FORK_READ_TOKEN` в workflow checkout — только если форк приложения станет приватным.

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
   `image: ghcr.io/romzes5000/portabase:${IMAGE_TAG}`  
   — так тег из `.env.deploy` совпадает с тем, что собрал CI.

4. Убедитесь, что пользователь SSH входит в группу `docker` **или** используйте root (не рекомендуется; лучше `docker` + `usermod -aG docker deploy`).

Путь `/opt/portabase` и имя файла зашиты в [`.github/workflows/build-and-deploy.yml`](.github/workflows/build-and-deploy.yml); при другом пути измените workflow.

## Локальная отладка pull

```bash
docker pull ghcr.io/romzes5000/portabase:<tag>
```
