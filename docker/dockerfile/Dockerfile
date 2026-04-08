FROM --platform=$BUILDPLATFORM node:22-bullseye AS base

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    bash \
    tzdata \
    libc6 \
    build-essential \
    g++ \
    make \
    autoconf \
    automake \
    libtool \
    git \
    nginx \
    && rm -rf /var/lib/apt/lists/*


RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt bullseye-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list

RUN apt-get update && apt-get install -y \
    postgresql-18 \
    postgresql-client-18 \
    postgresql-contrib-18 \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/usr/lib/postgresql/18/bin:${PATH}"


# Release binary (без git clone + go build на каждый CI)
FROM alpine:3.20 AS tusd-fetch
ARG TUSD_VERSION=2.8.0
ARG TARGETARCH
RUN apk add --no-cache curl ca-certificates \
    && curl -fsSL "https://github.com/tus/tusd/releases/download/v${TUSD_VERSION}/tusd_linux_${TARGETARCH}.tar.gz" \
    | tar xz \
    && mv "tusd_linux_${TARGETARCH}/tusd" /tusd \
    && chmod +x /tusd

FROM scratch AS tusd-dist
COPY --from=tusd-fetch /tusd /tusd


FROM base AS build-env

RUN corepack enable && corepack prepare pnpm@latest --activate

FROM build-env AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm i --frozen-lockfile

FROM build-env AS dev

COPY --from=deps /app/node_modules ./node_modules
COPY --from=tusd-fetch /tusd /usr/local/bin/tusd
RUN chmod +x /usr/local/bin/tusd
WORKDIR /app
COPY . .

USER root
RUN chmod +x /app/docker/entrypoints/app-dev-entrypoint.sh

ENTRYPOINT ["sh","/app/docker/entrypoints/app-dev-entrypoint.sh"]

FROM build-env AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=cache,id=next-cache,target=/app/.next/cache \
    pnpm run build

FROM base AS prod

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=80
ENV HOSTNAME="0.0.0.0"
ENV PGDATA=/data/postgres
ENV PRIVATE_PATH=/data/private


RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/portabase.config.ts ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder --chown=1001:1001 /app/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/.next/static ./.next/static
COPY --chown=1001:1001 src/db ./src/db
COPY --from=deps /app/node_modules ./node_modules

COPY --from=tusd-dist /tusd /usr/local/bin/tusd
RUN chmod +x /usr/local/bin/tusd

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf


RUN mkdir -p .next /data/private/uploads \
    && chown -R nextjs:nodejs .next /data/private /app/public


USER root
COPY ./docker/entrypoints/app-prod-entrypoint.sh /app/app-prod-entrypoint.sh
RUN chmod +x /app/app-prod-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["sh","/app/app-prod-entrypoint.sh"]
