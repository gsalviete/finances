# finances

> **Quanto eu ainda posso gastar até o final deste mês?**

Ferramenta pessoal de decisão financeira diária. Toda a especificação vive em [`docs/`](docs/) — os documentos são o **contrato** do projeto (arquitetura congelada).

## Documentação

| Documento                                                                                                                  | O que responde                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)                                                                             | O produto: visão, filosofia, requisitos (FR-001–036)                              |
| [`docs/DOMAIN_MODEL.md`](docs/DOMAIN_MODEL.md)                                                                             | Como cada número é calculado (3 lentes, ritmo, projeção, parcelas, virada de mês) |
| [`docs/DATABASE.md`](docs/DATABASE.md)                                                                                     | Coleções, campos e índices do MongoDB                                             |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                                             | Camadas, módulos, API REST, segurança                                             |
| [`docs/CLAUDE.md`](docs/CLAUDE.md)                                                                                         | Guia de implementação e invariantes inegociáveis                                  |
| [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) / [`MONOREPO_STRUCTURE.md`](docs/MONOREPO_STRUCTURE.md) | Fases de implementação e árvore física                                            |
| ADRs 014–017 (`docs/ADR-*.md`)                                                                                             | Decisões ratificadas durante a implementação                                      |
| [`docs/AUTOMATION_SHORTCUT.md`](docs/AUTOMATION_SHORTCUT.md)                                                               | **Guia autocontido da automação do iPhone** (Apple Shortcuts → API → Inbox)       |

Referência viva dos endpoints: Swagger em `http://localhost:3001/api/docs` (e `-json` para a spec OpenAPI).

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

**V1 funcional — Fases 1–24 concluídas, Fase 25 parcial** (ver `docs/IMPLEMENTATION_ROADMAP.md`). Backend completo (auth, categorias, transações + parcelamento, recorrências, plano mensal + virada idempotente, dashboard com as 3 lentes, settings, backup export/import/provider, automação com parser genérico + Inbox) e frontend Next.js completo (login, Home com Saldo Projetado dominante, transações, planejamento + assistente de mês, categorias, inbox, backup, ajustes; temas Light/Dark/System sem FOUC; sidebar/drawer responsivos). Hardening: Helmet, rate limit, CORS, cobertura da api ~96%. Pendências da Fase 25: E2E Playwright e varredura formal de acessibilidade.

O sistema sobe completo com `docker compose up` (web em `:3000`, API em `:3001`, Swagger em `:3001/api/docs`).
