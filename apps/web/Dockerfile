# syntax=docker/dockerfile:1
# Contexto de build: a RAIZ do monorepo (docker build -f apps/web/Dockerfile .).
# Fase 3: imagem do stub. Evolui na Fase 19 (Next.js standalone) sem mudar o contrato multi-stage.

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
# --ignore-scripts: pula o "prepare" (husky), que exige .git e não faz sentido em imagem
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @finances/web run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/web/dist ./dist
USER node
CMD ["node", "dist/main.js"]
