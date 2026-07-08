# finances

> **Quanto eu ainda posso gastar até o final deste mês?**

Ferramenta pessoal de decisão financeira diária. Toda a especificação vive em [`docs/`](docs/) — os documentos são o **contrato** do projeto (arquitetura congelada).

## Estrutura

Monorepo Turborepo + pnpm workspaces:

```
apps/
  api/        # backend (NestJS a partir da Fase 7) — stub na Fase 1
  web/        # frontend (Next.js a partir da Fase 19) — stub na Fase 1
packages/
  shared/     # fonte única: schemas Zod, tipos, Money, Time (Fases 5–6)
  ui/         # componentes React reutilizáveis (ADR-013)
  config/     # tsconfig, ESLint, Prettier e Jest compartilhados
docker/       # ambiente de containers (funcional a partir da Fase 4)
docs/         # especificação (contrato)
scripts/      # seed, migrations, backup manual (fases futuras)
```

## Comandos

Requisitos: Node >= 22 e pnpm 10.

```sh
pnpm install
pnpm build          # turbo run build
pnpm typecheck      # turbo run typecheck
pnpm lint           # turbo run lint
pnpm test           # turbo run test
pnpm format         # prettier --write .
pnpm format:check   # prettier --check .
```

## Convenções de engenharia

- **TypeScript strict** — base compartilhada em `packages/config/tsconfig` (`base.json` + `node.json`); alias `@/*` → `src/*` nos apps.
- **ESLint 9 (flat config)** + **Prettier** — regras/opções centralizadas em `packages/config/eslint` e `packages/config/prettier`; os arquivos na raiz apenas reexportam.
- **Jest + ts-jest** — base compartilhada em `packages/config/jest/node.mjs`.
- **Conventional Commits** obrigatórios — `commitlint` valida no hook `commit-msg`; `lint-staged` roda `eslint --fix` + `prettier --write` no `pre-commit` (Husky).
- `docs/` está no `.prettierignore`: é o contrato do projeto e nunca é reformatado automaticamente.

## Ambiente de desenvolvimento

```sh
cp .env.example .env   # uma única vez
docker compose up -d   # Mongo, Mongo Express, API (stub), WEB (stub)
docker compose down    # para tudo SEM apagar dados (volume nomeado persiste)
```

Serviços: MongoDB (`:27017`), Mongo Express (`:8081`, credenciais no `.env`), API (`:3001`, `GET /health`), WEB (`:3000`, `GET /health`). Todos com healthcheck, restart `unless-stopped` e uma única network dedicada. A definição vive em `docker/docker-compose.yml`; o `compose.yaml` da raiz apenas a inclui para que `docker compose up` funcione da raiz com o `.env` local.

## CI

GitHub Actions (`.github/workflows/ci.yml`), em push na `main` e em PRs: `install → lint → typecheck → test → build → docker build`. Qualquer etapa que falhe reprova o pipeline. As imagens Docker dos apps são construídas a partir dos `Dockerfile` em `apps/api` e `apps/web` (contexto = raiz do monorepo).

## Estado atual

**Fase 7 — Bootstrap da API (NestJS) concluída** (ver `docs/IMPLEMENTATION_ROADMAP.md`). API NestJS com env validado por Zod, logs Pino estruturados (`requestId`), filtro global de erros padronizados, Swagger em `/api/docs` e `/api/v1/health` (health/liveness/readiness). O frontend continua stub até a Fase 19; persistência Mongo entra na Fase 8.
