# portabase-deploy — CI/CD для форка Portabase

Репозиторий **[github.com/romzes5000/portabase-deploy](https://github.com/romzes5000/portabase-deploy)** собирает Docker-образ из [форка приложения](https://github.com/romzes5000/portabase) по фиксированному **ref** (тег или SHA) и публикует в GHCR.

## Возможности

- checkout `romzes5000/portabase` на заданный `ref`;
- сборка `./docker/dockerfile/Dockerfile`, target `prod`;
- push в `ghcr.io/<owner>/portabase:<tag>`.

## Запуск

1. **Actions** → **Build Portabase from fork** → **Run workflow**.
2. Укажите `ref`: полный **SHA** (40 hex) или **имя тега** на форке.
3. Опционально `image_tag` — иначе для SHA берётся короткий префикс, для тега — имя тега.

Политика веток и прод-рефов: [fork-workflow в репозитории portabase](https://github.com/romzes5000/portabase/blob/main/docs/fork-workflow.md).

## Секреты

| Секрет | Когда нужен |
|--------|-------------|
| (нет) | Публичный форк — checkout без токена. |
| `FORK_READ_TOKEN` | Приватный форк: fine-grained PAT, `Contents: Read` на `romzes5000/portabase`. Добавьте в workflow шаг checkout: `token: ${{ secrets.FORK_READ_TOKEN }}`. |

Образ в GHCR: убедитесь, что у пакета выставлены права **чтения** для нужных сред (или пакет public).

## Выкат

Шаги SSH / Ansible / API добавляйте в [`.github/workflows/build-and-deploy.yml`](.github/workflows/build-and-deploy.yml) после сборки.
