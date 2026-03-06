# Builder: зависимости и сборка из актуального кода (без кэша старого COPY . .)
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /usr/src/app

# Для prisma generate (prisma.config.ts читает DATABASE_URL)
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=$DATABASE_URL

# Зависимости (кэш ломается только при смене package*.json)
COPY package.json package-lock.json ./
RUN npm ci

# Весь код и Prisma — один слой: любое изменение кода/схемы/миграций пересобирает дальше
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/

RUN npx prisma generate && npm run build

# Runner: только артефакты, без исходников
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

WORKDIR /usr/src/app

COPY --from=builder --chown=nodejs:nodejs /usr/src/app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/prisma.config.ts ./
COPY --from=builder --chown=nodejs:nodejs /usr/src/app/src/generated ./src/generated
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown nodejs:nodejs docker-entrypoint.sh

USER nodejs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
