# IMPLEMENTATION_ROADMAP.md

Version: 1.0.0
Status: Final — pronto para Claude Code
Escopo: **apenas** fases de implementação. Não redefine produto nem arquitetura (ver os cinco documentos de especificação).

> **Contrato desta fase (invariantes de toda fase):** ao final de **cada** fase o projeto deve (1) **compilar** (`turbo build` verde), (2) subir com **`docker compose up`** sem erro, (3) ter **todos os testes passando**, (4) passar em **lint + typecheck**. Nenhuma fase pode deixar o repositório quebrado. Cada fase é **independente** e entregável isoladamente.
>
> Precedência de verdade: `DOMAIN_MODEL.md` (cálculo) → `DATABASE.md` (persistência) → `ARCHITECTURE.md` (estrutura) → `PROJECT_SPEC.md` (produto) → `CLAUDE.md` (como construir).

---

## Bloco A — Fundação (fases 1–4)

### Fase 1 — Esqueleto do monorepo
**Objetivo:** Turborepo com workspaces `apps/*` e `packages/*` vazios porém válidos.
**Aceite:** `turbo build` roda em cache vazio sem erro; `apps/api` e `apps/web` existem como stubs que compilam; `packages/shared`, `packages/ui`, `packages/config` existem com `package.json` e `index` vazio.
**Verde:** build ✓ · docker (ainda trivial) ✓ · testes (nenhum, mas runner configurado) ✓.

### Fase 2 — Toolchain de qualidade
**Objetivo:** TS strict, ESLint, Prettier, Husky, lint-staged, commitlint, path aliases — todos em `packages/config` e compartilhados.
**Aceite:** commit fora de Conventional Commits é bloqueado; `lint-staged` roda no pre-commit; `tsconfig` base estende para todos os workspaces; `noImplicitAny` ativo.
**Verde:** lint ✓ · typecheck ✓ · build ✓.

### Fase 3 — Pipeline de CI
**Objetivo:** GitHub Actions com `install → lint → typecheck → test → build → docker build`.
**Aceite:** qualquer etapa que falhe reprova o pipeline; roda em push e PR.
**Verde:** pipeline ✓ em commit limpo.

### Fase 4 — Ambiente Docker de desenvolvimento
**Objetivo:** `docker-compose.yml` com MongoDB, Mongo Express (dev), API, WEB; healthchecks, volumes persistentes, restart automático.
**Aceite:** `docker compose up` sobe tudo saudável; API responde num `/health` mínimo; nenhuma configuração depende da máquina local.
**Verde:** docker ✓ · health endpoint ✓.

---

## Bloco B — Núcleo compartilhado (fases 5–6)

### Fase 5 — Utils de domínio: Money + Time
**Objetivo:** em `packages/shared`, `Money` (centavos inteiros, soma/subtração/divisão exata, formatação) e `Time` (fronteiras de dia/mês em `America/Sao_Paulo`, derivação de `month`/`year`).
**Aceite:** testes cobrem `0.1+0.2` sem erro; divisão de parcelas soma exata; teste de fronteira às 23h59 do último dia do mês cai no mês correto; nenhum `float` cruza a fronteira do domínio.
**Verde:** unit tests ✓.

### Fase 6 — Schemas Zod (fonte única) + tipos + enums
**Objetivo:** todos os enums (`type`, `status`, `origin`, `kind`, `recurrenceType`) e schemas Zod das entidades em `packages/shared`; tipos via `z.infer`.
**Aceite:** uma mudança de campo exige **uma** edição conceitual; enums MAIÚSCULOS (exceto `theme`); validação e tipos derivam do mesmo schema.
**Verde:** typecheck ✓ · unit tests dos schemas ✓.

---

## Bloco C — Backend base (fases 7–9)

### Fase 7 — Bootstrap da API (NestJS)
**Objetivo:** app NestJS com config por env, Pino (JSON + `requestId`), filtro global de erros padronizados, Swagger, `/health` (health/readiness/liveness).
**Aceite:** erro nunca vaza stacktrace ao cliente (formato `{ success:false, error:{message,code,details} }`); Swagger acessível; logs estruturados sem dados sensíveis.
**Verde:** build ✓ · docker ✓ · e2e `/health` ✓.

### Fase 8 — Camada de persistência
**Objetivo:** conexão Mongo (Mongoose), repositório base, convenção de **soft delete** (`deletedAt`/`deletedBy`) aplicada por padrão nas leituras.
**Aceite:** leitura padrão filtra `deletedAt == null`; base repo testado com Mongo em container; denormalização `month`/`year` via hook na escrita.
**Verde:** integração com Mongo ✓.

### Fase 9 — Autenticação (single user)
**Objetivo:** módulo `Auth`, JWT, Argon2, guards; `register`, `login`, `me`. Separação Authentication/Authorization mesmo com um usuário.
**Aceite:** senha em Argon2; rota protegida rejeita sem token; `passwordHash` nunca sai em resposta.
**Verde:** unit + e2e de auth ✓.

---

## Bloco D — Domínio financeiro (fases 10–17)

### Fase 10 — Categorias
**Objetivo:** `Category` CRUD + arquivamento + restauração.
**Aceite:** categoria nunca é removida fisicamente; arquivada some das listas mas mantém histórico; restauração funciona; empty state previsto no contrato.
**Verde:** unit + e2e ✓.

### Fase 11 — Transações (CRUD + listagem)
**Objetivo:** `Transaction` com `status`, sinal derivado de `type`, soft delete com confirmação, listagem com **paginação por cursor** e índices de `DATABASE §3`.
**Aceite:** frontend nunca envia valor negativo; `amountCents > 0`; `categoryId` obrigatório; consulta de 1 ano <200ms com índices; `CANCELLED`/deletadas fora das agregações.
**Verde:** unit + integração + índices ✓.

### Fase 12 — Parcelamento
**Objetivo:** `InstallmentService` materializa N transações na criação (`installmentGroupId`), com divisão **exata** de centavos; parcela do mês corrente `CONFIRMED`, futuras `FORECAST`.
**Aceite:** `Σ parcelas == total` exatamente; editar/cancelar uma parcela não afeta as outras; nenhuma parcela calculada em runtime; sem conceito de "fatura".
**Verde:** teste de integridade de centavos ✓.

### Fase 13 — Regras recorrentes
**Objetivo:** `recurringRules` (CRUD) com `recurrenceType = MONTHLY`, `dayOfMonth`, janela `start/end`, `active`.
**Aceite:** editar uma regra **nunca** altera meses passados; `dayOfMonth` ajusta ao último dia em meses curtos.
**Verde:** unit + e2e ✓.

### Fase 14 — Plano mensal + virada de mês
**Objetivo:** `monthlyPlans` (itens **embutidos** `PENDING`), `MonthRolloverService` **idempotente e lazy**; materializa uma Transaction `FORECAST` por regra com `linkedPlanItemId`.
**Aceite:** rodar a virada duas vezes não duplica nada; mês anterior arquivado sem perda; parcelas futuras não são recriadas; escalares derivados nunca armazenados.
**Verde:** teste de idempotência da virada ✓.

### Fase 15 — Orçamento, confirmação e reconciliação
**Objetivo:** `BudgetService` (as três lentes), auto-confirmação `FORECAST→CONFIRMED` na data (exceto se editado/cancelado), promoção do plan item `PENDING→PAID` ao confirmar a transação vinculada.
**Aceite:** **teste explícito de não-double-count** (compromisso fixo nunca contado duas vezes); confirmar previsão não re-subtrai; edição manual prevalece sobre auto-confirmação.
**Verde:** unit do Budget + cenário de não-double-count ✓.

### Fase 16 — Dashboard
**Objetivo:** `ProjectionService`, `PacingService`, `CategoryStatisticsService` e `DashboardService` (orquestrador) → `GET /api/v1/dashboard` com todos os KPIs.
**Aceite:** todos os KPIs derivam do domínio (Saldo Projetado, Saldo Atual, gasto diário, ritmo, categorias, projeção); cálculo **em tempo de leitura**, sem cache; frontend não computa nada; resposta <200ms.
**Verde:** unit dos serviços + e2e do endpoint ✓.

### Fase 17 — Settings
**Objetivo:** `settings` (`GET`/`PUT`): tema, moeda, idioma, timezone, frequência de backup, motion, thresholds de ritmo (defaults na V1).
**Aceite:** tema persistido; `PUT` valida via Zod; defaults aplicados na criação do usuário.
**Verde:** unit + e2e ✓.

---

## Bloco E — Portabilidade (fase 18)

### Fase 18 — Backup / Export / Import
**Objetivo:** port `BackupProvider` + adapters `LocalStorage` (dev) e `ObjectStorage` (prod); `GET /export` (ZIP) e `POST /import` (estratégia de conflito explícita).
**Aceite:** export nunca inclui `passwordHash`/tokens/logs/sessions/`requestId`; import default `REPLACE` com confirmação; import inválido falha atomicamente sem corromper estado; backup automático não depende de filesystem efêmero.
**Verde:** unit dos adapters + round-trip export→import ✓.

---

## Bloco F — Frontend (fases 19–23)

### Fase 19 — Bootstrap do web
**Objetivo:** Next.js (App Router), design tokens, tema Light/Dark/System com **hint anti-FOUC** (cookie), shell de layout (sidebar desktop / drawer mobile), TanStack Query.
**Aceite:** troca de tema instantânea sem reload nem flash; nenhuma cor hardcoded (só tokens); ícones Lucide; motion 150–250ms.
**Verde:** build web ✓ · docker ✓.

### Fase 20 — Telas de Categorias e Transações
**Objetivo:** UI de CRUD de categorias e transações (incluindo parcelamento), com skeletons, empty states e feedback de ação.
**Aceite:** registrar um gasto em <10s; toda lista tem empty state; toda ação tem feedback; responsivo em mobile/desktop.
**Verde:** testes de componente + fluxo ✓.

### Fase 21 — Planejamento + assistente de mês
**Objetivo:** tela de planejamento (itens do snapshot, `PENDING/PAID`) e o assistente de início de mês (receitas/despesas recorrentes/investimento → resumo).
**Aceite:** confirmar o assistente gera o snapshot e as previsões `FORECAST`; edição recalcula na leitura seguinte.
**Verde:** fluxo do assistente ✓.

### Fase 22 — Home (dashboard, 3 lentes)
**Objetivo:** Home com **Saldo Projetado dominante**, Saldo Atual para conferência, gasto diário, ritmo (cores semânticas), projeção, últimas movimentações, top categorias.
**Aceite:** compreensível em <15s; Projetado nunca confundido com Atual; tudo vem pronto de `/dashboard`.
**Verde:** e2e da Home ✓.

### Fase 23 — Tela de Backup/Export/Import
**Objetivo:** UI para exportar/importar e configurar backup.
**Aceite:** confirmação obrigatória no import `REPLACE`; feedback de progresso/erro.
**Verde:** fluxo export→import ✓.

---

## Bloco G — Automação (fase 24, por último dentro da V1)

### Fase 24 — Automação (parser único) + Inbox
**Objetivo:** `POST /automation/notification` idempotente (`clientEventId`), **um** parser (Inter ou genérico), `draftTransactions`, endpoints de Inbox (`list/confirm/ignore/edit/delete`), UI da Inbox e documentação do Apple Shortcut.
**Aceite:** reenvio offline não duplica draft (índice único `{userId, clientEventId}`); automação **nunca** cria Transaction direto — sempre via Inbox; confiança abaixo do threshold marca "revisar", nunca inventa valor; fluxo completo Shortcut→API→Parser→Draft→Inbox→confirmação→Transaction sem lacunas.
**Verde:** unit do parser (amostras reais) + e2e do fluxo ✓.
**Nota:** só iniciar com amostras reais de notificação em mãos; se indisponíveis, vira fast-follow sem bloquear a V1.

---

## Bloco H — Endurecimento (fase 25)

### Fase 25 — Hardening da V1
**Objetivo:** rate limit, Helmet, CORS, varredura de acessibilidade (contraste/ARIA/foco/teclado/screen reader), E2E Playwright dos fluxos principais, cobertura >80%, Swagger completo, `.env.example`, README e docs finalizados.
**Aceite:** todos os critérios da seção "Success Criteria" do `PROJECT_SPEC`; sem código morto, sem TODO crítico, sem credenciais no repo; `docker compose up` sobe a V1 completa sem configuração adicional.
**Verde:** suíte completa (unit + integração + e2e) ✓ · cobertura ✓ · lint/typecheck ✓ · docker ✓.

---

## Mapa de dependências entre fases

```
1 → 2 → 3
      ↘ 4
2 → 5 → 6
6 → 7 → 8 → 9
9 → 10 → 11 → 12
        11 → 13 → 14 → 15 → 16 → 17
16/17 → 18
6 → 19 → 20 → 21 → 22 → 23     (frontend consome APIs já prontas)
11..17 → 24                    (automação depende do núcleo)
tudo → 25
```

Fases do mesmo nível podem ser paralelizadas. O frontend (19+) só começa quando as APIs que ele consome existirem, mas pode avançar em paralelo às fases de automação.
