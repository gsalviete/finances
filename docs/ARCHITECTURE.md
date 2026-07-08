# ARCHITECTURE.md

Version: 2.1.0
Status: Final — Architecture Gate Review PASSED

> Descreve **como o sistema é construído**. Entidades e fórmulas vivem em `DOMAIN_MODEL.md`; persistência em `DATABASE.md`; produto em `PROJECT_SPEC.md`.
> Diretriz: DDD-lite. Nada de DDD completo, Event Sourcing, CQRS ou microserviços. Simplicidade, legibilidade, baixo acoplamento, alta coesão, testabilidade.

---

## 1. Monorepo (Turborepo)

```
finances/
  apps/
    api/            # NestJS
    web/            # Next.js (App Router)
  packages/
    ui/             # componentes compartilhados (ADR-013)
    shared/         # schemas Zod (fonte única), tipos derivados, util Money, util Time
    config/         # tsconfig, eslint-config, prettier compartilhados
  docker/
  docs/             # PROJECT_SPEC, ARCHITECTURE, DOMAIN_MODEL, DATABASE, CLAUDE
  scripts/
  .github/          # CI
```

Tudo compartilha TypeScript, ESLint, Prettier, configs, tipos e componentes. Nunca duplicar código entre aplicações.

**`packages/shared` como fonte única de schema:** os schemas Zod são a verdade. Tipos TS derivam via `z.infer`; a validação de DTO no NestJS deriva do mesmo schema; o schema Mongoose é escrito a partir da mesma forma. Uma mudança de campo = uma edição conceitual, não quatro.

---

## 2. Backend (NestJS, DDD-lite)

### 2.1 Camadas e regra de dependência

```
Controller  →  Service  →  Repository  →  MongoDB
```

- Controllers nunca acessam o banco; só orquestram e validam entrada/saída.
- Repositories nunca contêm regra de negócio; só persistência.
- Services concentram a regra; nunca conhecem detalhes de frontend.
- Nenhum acesso ao Mongo fora dos repositories.

### 2.2 Estrutura de módulo

Cada módulo é autônomo e expõe apenas sua interface pública:

```
transactions/
  controller/  service/  repository/
  dto/  schemas/  mapper/  validators/
  interfaces/  tests/
```

Sem pasta "common" genérica com dezenas de arquivos sem relação. Código compartilhado só com propósito claro (vai para `packages/shared`).

### 2.3 Módulos da V1

`Users/Auth`, `Categories`, `Transactions`, `Planning` (dono das `recurringRules` e da virada de mês), `Dashboard` (orquestrador puro), `Automation` (dono de `draftTransactions`: ingest + Inbox de revisão; parser único — ADR-008), `Backup`, `Settings`, `Health`.

> **Simplificação (gate review):** `Automation` e `Inbox` foram unificados num **único módulo** `Automation`, dono da coleção `draftTransactions`. Ele expõe tanto o endpoint de ingestão (`/automation/notification`) quanto as operações da Inbox (`/inbox/...`). "Inbox" permanece como nome de UI, não como módulo separado — evita fronteira artificial entre produtor e consumidor da mesma coleção.

> **Recomendação de sequência (não de escopo):** a automação é a parte mais frágil (formatos de notificação mudam sem aviso) e deve ser o **último módulo implementado dentro da V1**, após o núcleo estar sólido e com amostras reais de notificação em mãos. Ela pertence à V1 por decisão explícita (ADR-008), mas não deve bloquear o restante do núcleo.

**Placeholder documentado:** `AI` — módulo vazio com README descrevendo o **port** pretendido. A interface `AIProvider` e qualquer adapter concreto **só serão criados quando houver a primeira implementação real** (evita abstração sem uso; ver Resumo Executivo, ponto em aberto).

### 2.4 Domain Services (núcleo determinístico)

Toda regra financeira vive em serviços puros, reutilizáveis pela IA futura:

`BudgetService`, `ProjectionService`, `PacingService`, `MonthRolloverService`, `InstallmentService`, `CategoryStatisticsService`.

As fórmulas exatas estão em `DOMAIN_MODEL.md §4–6`. Estes serviços não fazem I/O direto além dos repositories injetados e são 100% testáveis isoladamente.

### 2.5 Dashboard Engine

O `DashboardService` **orquestra** os domain services e devolve um DTO único; não consulta múltiplas coleções diretamente nem espalha lógica.

```
DashboardService
  → BudgetService (Saldo Projetado, Saldo Atual, Planejado)
  → PacingService
  → ProjectionService
  → CategoryStatisticsService
  → DashboardResponseDTO
```

O frontend nunca monta indicadores; recebe tudo pronto de `GET /api/v1/dashboard`.

### 2.6 Recálculo (por leitura, sem camada de recomputação)

Sem event sourcing e **sem `RecalculationService`**. Todos os KPIs são derivados **em tempo de leitura** pelo `DashboardService` a partir das `transactions` — nada é denormalizado ou cacheado (os escalares de `monthlyPlans` foram removidos justamente por isso). Assim, "recalcular imediatamente após qualquer alteração" (Constitution / FR-008) é satisfeito naturalmente: como não há valor derivado armazenado, a próxima leitura já reflete o estado atual. Introduzir um serviço de recomputação em escrita seria uma camada redundante. O custo de agregar um mês (query indexada `{userId, year, month, status}` + soma em memória) é trivial na ordem de milhares de transações/ano.

---

## 3. API REST

- Recursos:
  - `auth` — `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (single user na V1).
  - `categories` — CRUD; arquivamento/restauração via `PATCH` do campo `archived`.
  - `transactions` — CRUD; confirmação (`FORECAST→CONFIRMED`) e cancelamento (`→CANCELLED`) via `PATCH /transactions/:id`; criação parcelada materializa N itens.
  - `recurring-rules` — CRUD das `recurringRules` (usado no onboarding e na gestão de recorrências).
  - `planning` — `GET` (plano do mês corrente/por `year,month`), `PUT` (editar itens), `POST` (forçar criação do plano de um mês). A virada de mês é **lazy no servidor** (disparada na primeira leitura de dashboard/planning do mês); este `POST` é o gatilho manual equivalente.
  - `dashboard` — `GET` único com todos os KPIs.
  - `settings` — `GET`, `PUT` (tema, moeda, idioma, timezone, frequência de backup, motion). Necessário para persistir tema (FR-034–036) e preferências.
  - `automation/notification` — `POST`, idempotente via `clientEventId`.
  - `inbox` — `GET` (listar drafts), `POST /inbox/:id/confirm`, `POST /inbox/:id/ignore`, `PUT /inbox/:id` (editar), `DELETE /inbox/:id`. (Servidos pelo módulo `Automation`.)
  - `backup` — `GET /export`, `POST /import`.
  - `health` — `GET` (health/readiness/liveness).
- Prefixo obrigatório e versionado: `/api/v1/`. Nunca GraphQL.

**Erros padronizados** (nunca stacktrace ao frontend):

```json
{ "success": false, "error": { "message": "...", "code": "...", "details": {} } }
```

---

## 4. Logging & Observabilidade

- **Pino**, logs estruturados em JSON, `requestId` por requisição.
- Nunca logar senhas, tokens ou dados pessoais.
- Health/readiness/liveness. Métricas simples: tempo médio, tempo por endpoint, contagem de erros. Observabilidade "suficiente para diagnóstico", sem stack enterprise.

---

## 5. Backup — port/adapter (ADR + backup revisado)

Único lugar onde a abstração port/adapter se justifica na V1, porque tem **duas implementações reais**:

```
BackupProvider (port)
  ├── LocalStorageProvider   (desenvolvimento)
  └── ObjectStorageProvider  (produção — S3/GCS compatível)
```

Backup automático nunca depende de filesystem efêmero. Export manual continua sendo download direto. Conteúdo exportado exclui dados sensíveis (ver `DATABASE.md §2` e ADR-012).

---

## 6. Frontend (Next.js, App Router)

- TypeScript. RSC onde fizer sentido; Client Components apenas quando necessário.
- **Estado:** TanStack Query para estado remoto; React Context apenas para tema/sessão; local state para componentes. Sem Redux. Nada de estado global desnecessário.
- **Componentização:** responsabilidade única (`RemainingBudgetCard`, `DailyBudgetCard`, `PacingCard`, `CategoryCard`, `TransactionCard`, etc.). Reutilizáveis vão para `packages/ui`.
- **Design System:** tokens obrigatórios, nenhuma cor hardcoded; tema Light/Dark/System com troca instantânea. Persistência em banco **e** hint em cookie para evitar FOUC no primeiro paint.
- **Cores semânticas:** verde=confortável, amarelo=atenção, vermelho=crítico, azul=neutro. Nunca cor só por estética.
- **Ícones:** Lucide exclusivamente. Sem emojis, sem ilustrações, sem ícones coloridos.
- **Motion:** Framer Motion, 150–250ms, sempre com propósito, nunca bloqueia interação.
- **Loading:** skeletons em páginas; spinner só para micro-ações. Empty states em toda lista.
- **Responsividade:** desktop prioridade; mobile mantém todas as funcionalidades (muda só o layout). Sidebar fixa no desktop, drawer no mobile.
- **Acessibilidade:** contraste, ARIA, foco, navegação por teclado, screen readers — requisito **transversal da V1**.

---

## 7. Segurança (transversal V1)

HTTPS, JWT, Argon2, rate limit, Helmet, CORS configurado, validação de entrada em todos os endpoints. Nunca confiar no frontend. Separação explícita entre Authentication e Authorization mesmo com um único usuário. Secrets só em `.env` / `.env.example`, nunca no repositório; variáveis obrigatórias documentadas.

---

## 8. Testes

- Backend: unitários (services, repositories, validators, mappers), integração (controllers, Mongo, fluxos), E2E dos endpoints principais.
- Frontend: componentes críticos e fluxos principais (Playwright).
- Cobertura alvo > 80%, sem perseguir número em detrimento de qualidade.
- Cenários obrigatórios: não-double-count (§C1 histórico), virada de mês idempotente, integridade de centavos em parcelamento, fronteira de mês às 23h59 no fuso local.

---

## 9. Docker, CI/CD, Deploy

- `docker compose up` sobe tudo: MongoDB, Mongo Express (dev), API, WEB. Volumes persistentes, healthchecks, restart automático.
- **CI (GitHub Actions):** install → lint → typecheck → unit tests → build → docker build. Qualquer etapa falha ⇒ pipeline falha.
- **Deploy:** 100% containerizado, agnóstico de infra (EC2, Railway, Coolify, Oracle Cloud, servidor próprio). Nenhuma configuração depende da máquina local. Backup em Object Storage garante portabilidade em ambientes efêmeros.

---

## 10. Preparação para IA (sem implementar)

Fluxo pretendido, documentado mas não construído na V1:

```
Usuário → Chat → AIService → (Budget/Projection/Statistics)Service → Resposta
```

A IA nunca acessa Mongo diretamente, nunca calcula valores, nunca inventa dados. Reutiliza os domain services determinísticos. O sistema funciona 100% sem IA (Constitution #9–10).
