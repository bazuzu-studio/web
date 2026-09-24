# syntax=docker/dockerfile:1
FROM node:22-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@10
WORKDIR /app

# ---------- зависимости ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# ---------- сборка ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* вшиваются в клиентский бандл при сборке — их нужно передать как build args
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GRAPHQL_API_URL
ARG S3_PUBLIC_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GRAPHQL_API_URL=$NEXT_PUBLIC_GRAPHQL_API_URL \
    S3_PUBLIC_URL=$S3_PUBLIC_URL

# Типы GraphQL: лучше закоммитить src/generated/graphql.ts (pnpm codegen локально).
# Если файла нет, пробуем сгенерировать из CMS (в продакшене у Payload обычно
# отключена интроспекция, поэтому это запасной вариант).
RUN if [ ! -f src/generated/graphql.ts ]; then \
      echo "src/generated/graphql.ts не найден — запускаю codegen"; \
      pnpm codegen || { echo "ОШИБКА: codegen не сработал. Выполните 'pnpm codegen' локально и закоммитьте src/generated/graphql.ts"; exit 1; }; \
    fi
RUN pnpm build

# ---------- рантайм ----------
FROM node:22-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN useradd --create-home --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
