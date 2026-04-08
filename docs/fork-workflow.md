# Ветки форка и деплой (Oxem)

Этот документ фиксирует договорённости для [форка на GitHub](https://github.com/romzes5000/portabase) и отдельного репозитория CI/CD: **[Oxem-Studio/portabase-deploy](https://github.com/Oxem-Studio/portabase-deploy)** (см. также [deployment/README.md](https://github.com/romzes5000/portabase/tree/main/deployment) в форке — зеркало инструкций).

## Интеграция: ветка `main`

- **`main`** — основная долгоживущая линия интеграции на форке (плюс **`oxem/deploy`** только для прод-деплоя Oxem).
- Фичи и фиксы вносятся через **короткоживущие ветки** `feat/*`, `fix/*` от актуального `main` и сливаются в `main` через pull request.
- Периодически в `main` **вливается апстрим**: `Portabase/portabase` (`upstream/main` или релизный тег `v*`), см. раздел ниже.

Исключение: ветка **`oxem/deploy`** — постоянная линия для **прод-деплоя Oxem** (см. раздел ниже). Иначе отдельные долгоживущие ветки вроде `dev` не используются без необходимости, чтобы не плодить расхождения с `main`.

## Синхронизация с первоисточником

1. Remote `upstream` → `https://github.com/Portabase/portabase.git`.
2. Команда (пример):

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   # разрешить конфликты при необходимости
   git push origin main
   ```

3. Если нужны только стабильные релизы апстрима — мержить тег `vX.Y.Z` вместо `upstream/main`.

Рекомендуется назначить **периодичность** (например раз в спринт или после релиза Portabase) и ответственного за merge.

## Продакшен: тег или SHA, не «плавающий» `main`

- **Прод** деплоится с **зафиксированного ref** на форке: **git-тег** (например `deploy-2025-04-08`, свой semver) или **SHA коммита**.
- Так воспроизводим сборку и откаты.
- Ветка **`main`** удобна для **staging** / внутреннего контура, если нужен автодеплой «последнего коммита»; для прода это опционально и осознанно.

Сборка и выкат выполняются из **[portabase-deploy](https://github.com/Oxem-Studio/portabase-deploy)** (`checkout` форка на выбранный `ref`).

## Ветка `oxem/deploy` и автодеплой

- В **`oxem/deploy`** вливается то, что должно уехать на сервер Oxem; **merge в `main` форка не обязателен** для выката.
- При **каждом push** в `oxem/deploy` workflow **[`.github/workflows/oxem-deploy-dispatch.yml`](../.github/workflows/oxem-deploy-dispatch.yml)** вызывает `workflow_dispatch` в **portabase-deploy** с `ref` = **SHA коммита** и `deploy_to_server=true` (сборка на self-hosted runner org и деплой по SSH).

### Секрет на форке (один раз)

В репозитории **[romzes5000/portabase](https://github.com/romzes5000/portabase)** → **Settings → Secrets and variables → Actions** добавьте:

| Секрет | Назначение |
|--------|------------|
| `OXEM_DEPLOY_WORKFLOW_DISPATCH_TOKEN` | [Classic PAT](https://github.com/settings/tokens): минимум **`workflow`** и доступ к репозиторию **`Oxem-Studio/portabase-deploy`** (обычно достаточно **`repo`** для приватного репо или **`public_repo`** + права на вызов Actions — при ошибке 403 расширьте scope). Токен используется только для `POST` dispatch workflow в `portabase-deploy`. |

Без этого секрета job **Dispatch Oxem deploy** завершится ошибкой; ручной запуск **Build Portabase from fork** в `portabase-deploy` по-прежнему доступен.

## GitHub Actions на форке

Автоматический релиз и публикация образов, завязанные на инфраструктуру апстрима, **выполняются только в репозитории `Portabase/portabase`**, не на форке (см. условия в `.github/workflows/release.yml` и `release-candidate.yml`).

Свой образ и деплой настраиваются в **[portabase-deploy](https://github.com/Oxem-Studio/portabase-deploy)**. Дополнительно на форке: **автодеплой** при push в `oxem/deploy` (см. выше).
