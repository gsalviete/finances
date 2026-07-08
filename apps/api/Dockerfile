# syntax=docker/dockerfile:1
# Contexto de build: a RAIZ do monorepo (docker build -f apps/api/Dockerfile .).
# Fase 7: NestJS. Build com deps completas; runtime com node_modules podado (prune --prod).

FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
# --ignore-scripts: pula o "prepare" (husky), que exige .git e não faz sentido em imagem
RUN pnpm install --frozen-lockfile --ignore-scripts
# constrói a api e suas dependências de workspace (@finances/shared)
RUN pnpm --filter @finances/api... run build
# reinstala somente dependências de produção (devDeps ficam fora do runtime)
RUN CI=true pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo .
USER node
CMD ["node", "apps/api/dist/main.js"]
