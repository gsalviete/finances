# syntax=docker/dockerfile:1
# Contexto de build: a RAIZ do monorepo (docker build -f apps/web/Dockerfile .).
# Fases 19–23: Next.js com output standalone (server.js autocontido).

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
# --ignore-scripts: pula o "prepare" (husky), que exige .git e não faz sentido em imagem
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @finances/web... run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
CMD ["node", "apps/web/server.js"]
