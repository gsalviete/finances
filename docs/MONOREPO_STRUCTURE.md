# MONOREPO_STRUCTURE.md

Version: 1.0.0
Status: Final — guia de estrutura para Claude Code
Escopo: árvore física completa do monorepo. Reflete `ARCHITECTURE.md` (pós-gate review): módulo `Automation` unificado (dono da Inbox), sem `RecalculationService`, endpoints completos.

> Este documento é o **mapa físico**. Serve de guia para a criação inicial do projeto. Não introduz escopo novo.

---

## 1. Raiz

```
finances/
├── apps/                    # aplicações executáveis (deployáveis)
│   ├── api/                 # backend NestJS
│   └── web/                 # frontend Next.js
├── packages/                # código compartilhado (não deployável isoladamente)
│   ├── shared/              # fonte única: schemas Zod, tipos, Money, Time
│   ├── ui/                  # componentes React reutilizáveis (ADR-013)
│   └── config/              # tsconfig, eslint, prettier compartilhados
├── docker/                  # Dockerfiles e configs de container
├── docs/                    # os documentos de especificação (contrato)
├── scripts/                 # scripts operacionais e migrations
├── .github/                 # workflows de CI
├── .husky/                  # git hooks
├── turbo.json               # pipeline Turborepo
├── package.json             # workspaces + scripts raiz
├── pnpm-workspace.yaml      # definição de workspaces (pnpm)
├── commitlint.config.js
├── .gitignore
├── .env.example             # todas as variáveis obrigatórias, documentadas
└── README.md
```

**Responsabilidades dos diretórios raiz:**
- `apps/` — o que roda em produção. Cada app é independente e containerizável.
- `packages/` — código sem vida própria, consumido pelos apps. Nunca duplicar código entre apps: se é compartilhado, vive aqui.
- `docker/` — tudo que define containers e o ambiente local.
- `docs/` — o contrato de implementação (os cinco documentos + roadmap + esta árvore).
- `scripts/` — tarefas fora do runtime (seed, migrations, backup manual).
- `.github/` — automação de CI.

---

## 2. `apps/api` (NestJS, DDD-lite)

```
apps/api/
├── src/
│   ├── main.ts                     # bootstrap: Pino, Swagger, filtro de erros, versionamento
│   ├── app.module.ts
│   ├── config/                     # carregamento e validação de env (Zod)
│   │   ├── config.module.ts
│   │   └── env.schema.ts
│   ├── common/                     # infra transversal COM propósito claro (não é depósito)
│   │   ├── logging/                # Pino + requestId
│   │   ├── errors/                 # exception filter, formato padronizado
│   │   ├── auth/                   # guards, decorators, estratégias JWT
│   │   └── database/               # conexão Mongo, base repository, soft-delete plugin
│   └── modules/
│       ├── health/
│       │   ├── health.controller.ts
│       │   └── health.module.ts
│       ├── users/
│       │   ├── controller/  service/  repository/
│       │   ├── dto/  schemas/  mapper/  validators/  interfaces/
│       │   ├── tests/
│       │   └── users.module.ts
│       ├── auth/                   # register, login, me (single user na V1)
│       │   └── (mesma estrutura de módulo)
│       ├── categories/             # CRUD + arquivamento/restauração
│       ├── transactions/           # CRUD, status, sinal; InstallmentService
│       │   ├── controller/  service/  repository/
│       │   ├── services/
│       │   │   └── installment.service.ts
│       │   ├── dto/  schemas/  mapper/  validators/  interfaces/  tests/
│       │   └── transactions.module.ts
│       ├── planning/               # recurringRules + monthlyPlans + virada de mês
│       │   ├── controller/         # /planning e /recurring-rules
│       │   ├── repository/
│       │   ├── services/
│       │   │   ├── month-rollover.service.ts   # idempotente, lazy
│       │   │   └── recurring-rules.service.ts
│       │   └── planning.module.ts
│       ├── dashboard/              # orquestrador puro; cálculo em tempo de leitura
│       │   ├── dashboard.controller.ts         # GET /dashboard
│       │   ├── dashboard.service.ts            # orquestra os domain services
│       │   ├── services/
│       │   │   ├── budget.service.ts           # 3 lentes (Projetado/Atual/Planejado)
│       │   │   ├── projection.service.ts
│       │   │   ├── pacing.service.ts
│       │   │   └── category-statistics.service.ts
│       │   ├── dto/                            # DashboardResponseDTO
│       │   └── tests/
│       ├── automation/            # dono de draftTransactions: ingest + Inbox (parser único)
│       │   ├── controller/
│       │   │   ├── automation.controller.ts    # POST /automation/notification (idempotente)
│       │   │   └── inbox.controller.ts         # /inbox: list/confirm/ignore/edit/delete
│       │   ├── repository/
│       │   ├── parsers/
│       │   │   ├── parser.interface.ts         # contrato de parser
│       │   │   ├── inter.parser.ts             # OU generic.parser.ts (um só na V1)
│       │   │   └── parser.registry.ts          # preparado para múltiplos, um ativo
│       │   ├── services/
│       │   │   └── automation.service.ts
│       │   └── tests/
│       ├── settings/              # GET/PUT preferências (tema, motion, backup freq.)
│       ├── backup/                # export/import + provider port
│       │   ├── backup.controller.ts            # /export, /import
│       │   ├── providers/
│       │   │   ├── backup-provider.interface.ts   # port
│       │   │   ├── local-storage.provider.ts      # dev
│       │   │   └── object-storage.provider.ts     # prod (S3/GCS-compat)
│       │   ├── services/
│       │   │   ├── export.service.ts
│       │   │   └── import.service.ts
│       │   └── tests/
│       └── ai/                    # PLACEHOLDER documentado — sem código concreto
│           └── README.md          # descreve o port pretendido; AIProvider só quando houver impl
├── test/                          # e2e (Nest + Mongo em container)
├── Dockerfile
├── tsconfig.json
└── package.json
```

**Regras estruturais (de `ARCHITECTURE.md`):**
- Camadas: `controller → service → repository → mongo`. Controllers nunca tocam o banco; repositories nunca têm regra de negócio.
- Cada módulo expõe só sua interface pública. Nada de `common/` como depósito genérico.
- Domain services são puros e testáveis isoladamente; reutilizáveis pela IA futura.
- **Não existe** `RecalculationService`: os KPIs são calculados em tempo de leitura pelo `dashboard`.
- `automation` é **um** módulo (ingest + Inbox), dono de `draftTransactions`.

---

## 3. `apps/web` (Next.js, App Router)

```
apps/web/
├── src/
│   ├── app/                        # App Router
│   │   ├── layout.tsx              # shell + providers (tema, TanStack Query)
│   │   ├── (dashboard)/page.tsx    # Home — 3 lentes
│   │   ├── transactions/page.tsx
│   │   ├── planning/page.tsx       # planejamento + assistente de mês
│   │   ├── categories/page.tsx
│   │   ├── inbox/page.tsx          # UI da Inbox (consome módulo automation)
│   │   ├── settings/page.tsx
│   │   ├── backup/page.tsx
│   │   └── about/page.tsx
│   ├── components/                 # componentes específicos do app
│   │   ├── dashboard/              # RemainingBudgetCard, DailyBudgetCard, PacingCard...
│   │   ├── transactions/
│   │   ├── planning/
│   │   └── layout/                 # Sidebar (desktop), Drawer (mobile)
│   ├── features/                   # hooks + queries por domínio (TanStack Query)
│   │   ├── transactions/
│   │   ├── planning/
│   │   ├── dashboard/
│   │   └── ...
│   ├── lib/
│   │   ├── api-client.ts           # cliente REST tipado (tipos de packages/shared)
│   │   ├── theme.ts                # tema + hint anti-FOUC (cookie)
│   │   └── format.ts               # formatação monetária na borda (usa Money de shared)
│   └── styles/
│       └── tokens.css              # design tokens (nenhuma cor hardcoded)
├── public/
├── e2e/                            # Playwright
├── Dockerfile
├── next.config.js
├── tsconfig.json
└── package.json
```

**Regras (de `ARCHITECTURE.md §6`):**
- Estado remoto via TanStack Query; Context só para tema/sessão; sem Redux.
- Componentes de responsabilidade única; reutilizáveis migram para `packages/ui`.
- Design tokens obrigatórios; ícones Lucide; motion 150–250ms; skeletons + empty states.
- O frontend **nunca** calcula indicadores financeiros — consome `/dashboard`.

---

## 4. `packages/shared` (fonte única)

```
packages/shared/
├── src/
│   ├── money/                      # centavos inteiros: soma, divisão exata, formatação
│   ├── time/                       # America/Sao_Paulo: fronteiras de dia/mês, month/year
│   ├── schemas/                    # Zod: transaction, category, monthlyPlan, recurringRule...
│   ├── enums/                      # type, status, origin, kind, recurrenceType
│   └── types/                      # tipos via z.infer (derivados dos schemas)
├── tsconfig.json
└── package.json
```

Uma mudança de campo = uma edição aqui. Backend (DTO/Mongoose) e frontend (tipos) derivam desta fonte.

---

## 5. `packages/ui` e `packages/config`

```
packages/ui/
├── src/                            # componentes React genéricos (Button, Card, Dialog...)
├── tsconfig.json
└── package.json

packages/config/
├── tsconfig/                       # tsconfig base + variantes (node, next)
├── eslint/                         # eslint-config compartilhado
├── prettier/                       # prettier config
└── package.json
```

`packages/ui` é a única concessão consciente de "estrutura antes da necessidade" (ADR-013): custo mínimo, benefício futuro quando houver segundo consumidor.

---

## 6. `docker`, `docs`, `scripts`, `.github`

```
docker/
├── docker-compose.yml              # Mongo, Mongo Express (dev), API, WEB
├── mongo/                          # init scripts, se necessário
└── (Dockerfiles ficam junto de cada app)

docs/
├── PROJECT_SPEC.md
├── ARCHITECTURE.md
├── DOMAIN_MODEL.md
├── DATABASE.md
├── CLAUDE.md
├── IMPLEMENTATION_ROADMAP.md
└── MONOREPO_STRUCTURE.md

scripts/
├── seed.ts                         # dados de desenvolvimento
├── migrate/                        # migrations versionadas (schemaVersion)
└── backup.ts                       # backup manual via BackupProvider

.github/
└── workflows/
    └── ci.yml                      # install → lint → typecheck → test → build → docker build
```

---

## 7. Coleções MongoDB (referência rápida — detalhe em `DATABASE.md`)

```
users · categories · transactions · monthlyPlans (itens embutidos)
recurringRules · draftTransactions · settings · backups (metadados)
```

Índices, tipos e convenções (centavos, soft delete, denormalização month/year) vivem em `DATABASE.md`.
