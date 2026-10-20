# syntax=docker/dockerfile:1
# multi-stage: deps → build → runner（Next.js の standalone 出力）

FROM node:24.22.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:24.22.0-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# アプリ本体と、migrate / seed を依存込みの単一ファイルに束ねたもの（runner に drizzle-kit を入れないため）
RUN npm run build && npm run build:scripts

FROM node:24.22.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=UTC
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/dist-scripts ./dist-scripts
COPY --from=build --chown=node:node /app/scripts/session-token.mjs ./scripts/session-token.mjs
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/seed ./seed
# runner では npm run db:migrate / db:seed が束ねた JS を呼ぶようにする
COPY --chown=node:node docker/runner-package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "server.js"]
