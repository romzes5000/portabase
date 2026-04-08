# Ветки форка и деплой (Oxem)

Этот документ фиксирует договорённости для [форка на GitHub](https://github.com/romzes5000/portabase) и отдельного репозитория CI/CD: **[Oxem-Studio/portabase-deploy](https://github.com/Oxem-Studio/portabase-deploy)** (см. также [deployment/README.md](https://github.com/romzes5000/portabase/tree/main/deployment) в форке — зеркало инструкций).

## Интеграция: ветка `main`

- **`main`** — единственная долгоживущая линия интеграции на форке.
- Фичи и фиксы вносятся через **короткоживущие ветки** `feat/*`, `fix/*` от актуального `main` и сливаются в `main` через pull request.
- Периодически в `main` **вливается апстрим**: `Portabase/portabase` (`upstream/main` или релизный тег `v*`), см. раздел ниже.

Отдельная постоянная ветка вроде `dev` / `oxem` не используется без необходимости, чтобы не плодить расхождения с `main`.

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

## GitHub Actions на форке

Автоматический релиз и публикация образов, завязанные на инфраструктуру апстрима, **выполняются только в репозитории `Portabase/portabase`**, не на форке (см. условия в `.github/workflows/release.yml` и `release-candidate.yml`).

Свой образ и деплой настраиваются в **[portabase-deploy](https://github.com/Oxem-Studio/portabase-deploy)**.
