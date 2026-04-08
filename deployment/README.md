# CI/CD и деплой (отдельный репозиторий)

Шаблон для **отдельного** GitHub-репозитория (например `oxem/portabase-deploy`), который:

- клонирует форк приложения [`romzes5000/portabase`](https://github.com/romzes5000/portabase) на заданный **ref** (тег или SHA);
- собирает Docker-образ и публикует в ваш registry;
- при необходимости выполняет выкат (SSH, Ansible, API — подставьте свои шаги).

## Как использовать

1. Создайте **новый пустой репозиторий** на GitHub (например `your-org/portabase-deploy`).
2. Скопируйте из этой папки файл [`.github/workflows/build-and-deploy.yml`](.github/workflows/build-and-deploy.yml) в корень того репозитория (сохраните путь `.github/workflows/`).
3. В настройках репозитория добавьте **Secrets** (и при необходимости **Environments**):
   - `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` — или используйте `GITHUB_TOKEN` + GHCR;
   - для приватного форка — `FORK_READ_TOKEN` (fine-grained PAT с `Contents: Read` на `romzes5000/portabase`);
   - секреты для деплоя (SSH key, webhook и т.д.).
4. Запуск:
   - **workflow_dispatch** с полями `ref` (тег или полный SHA) и опционально `image_tag`;
   - либо добавьте триггер `push: tags:` под вашу схему тегов.

Политика веток и прод-рефов описана в [docs/fork-workflow.md](../docs/fork-workflow.md).

## Публичный и приватный форк

Публичный форк: `actions/checkout` с `repository: romzes5000/portabase` обычно **без** `token`.

Приватный форк: в шаге checkout добавьте `token: ${{ secrets.FORK_READ_TOKEN }}` (fine-grained PAT, read к репозиторию форка).
