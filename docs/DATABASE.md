# DATABASE.md

Version: 2.1.0
Status: Final — Architecture Gate Review PASSED
Banco: MongoDB (Mongoose)

> Este documento descreve a **persistência física**. O significado das entidades e das regras vive em `DOMAIN_MODEL.md`; aqui tratamos de coleções, tipos, índices e evolução.
> Motivação da escolha (mantida): simplicidade, flexibilidade de schema, baixo custo, facilidade de deploy.

---

## 1. Regras globais de armazenamento

- **Dinheiro:** todo valor monetário é `Int` em **centavos** (`amountCents`). Nunca `Double`. (ADR-004)
- **Datas:** armazenadas em UTC. `month`/`year` são denormalizados no fuso `America/Sao_Paulo` no momento da escrita. (ADR-005)
- **Soft delete:** entidades principais possuem `deletedAt: Date | null` e `deletedBy: ObjectId | null`. Consultas de domínio filtram `deletedAt == null` por padrão. (ADR-010)
- **Multiusuário:** todas as coleções de domínio possuem `userId`, mesmo com um único usuário na V1.
- **Timestamps:** `createdAt` / `updatedAt` em todas as coleções.

---

## 2. Coleções

### 2.1 `users`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `name` | String | |
| `email` | String | único |
| `passwordHash` | String | Argon2. **Nunca exportado.** (ADR-012) |
| `createdAt` / `updatedAt` | Date | |

### 2.2 `categories`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | |
| `name` | String | |
| `icon` | String | nome do ícone Lucide |
| `color` | String | token de cor, nunca hardcoded |
| `active` | Boolean | |
| `archived` | Boolean | arquivamento lógico; nunca removida fisicamente |
| `sortOrder` | Int | ordem manual de exibição, >= 0 (ADR-016) |
| `expiresAt` | Date \| null | categoria temporária; `null` = permanente (ADR-016) |
| `deletedAt` / `deletedBy` | Date / ObjectId | |
| `createdAt` / `updatedAt` | Date | |

> ADR-016: exclusão (soft delete) de categoria **em uso** por transações não-deletadas é bloqueada (409); o caminho é o arquivamento. Sem índices novos para `sortOrder`/`expiresAt`.

### 2.3 `transactions` (agregado central)

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | |
| `categoryId` | ObjectId | **obrigatório** |
| `type` | String enum | `INCOME` \| `EXPENSE` |
| `status` | String enum | `FORECAST` \| `CONFIRMED` \| `CANCELLED` |
| `amountCents` | Int | magnitude positiva, centavos |
| `description` | String | |
| `date` | Date | UTC |
| `month` | Int | 1–12, derivado no fuso local |
| `year` | Int | derivado no fuso local |
| `origin` | String enum | `MANUAL` \| `AUTOMATION` \| `IMPORT` |
| `linkedPlanItemId` | ObjectId \| null | vínculo com item de planejamento (compromisso) |
| `installmentGroupId` | ObjectId \| null | agrupa parcelas |
| `installmentNumber` | Int \| null | posição da parcela |
| `installmentTotal` | Int \| null | total de parcelas |
| `deletedAt` / `deletedBy` | Date / ObjectId | |
| `createdAt` / `updatedAt` | Date | |

> Removido da V1: `paymentMethod`. Não há controle de cartão; a distinção fixo/variável é dada por `linkedPlanItemId`. Se um método de pagamento for necessário no futuro, entra por RFC.

### 2.4 `monthlyPlans`

Snapshot de intenção. `monthlyPlanItems` é um **array embutido**.

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | |
| `month` / `year` | Int | |
| `archived` | Boolean | mês encerrado (não destrutivo) |
| `notes` | String | |
| `monthlyPlanItems` | Array\<PlanItem\> | embutido |
| `createdAt` / `updatedAt` | Date | |

**PlanItem (embutido):**

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | id do subdocumento |
| `kind` | String enum | `INCOME` \| `EXPENSE` \| `INVESTMENT` |
| `description` | String | |
| `amountCents` | Int | valor congelado do mês |
| `categoryId` | ObjectId | |
| `status` | String enum | `PENDING` \| `PAID` |
| `linkedTransactionId` | ObjectId \| null | transação que realiza o item |

> `expectedIncome`, `fixedExpenses`, `investmentGoal`, `availableBudget` escalares foram **removidos**. Esses valores agora são **derivados** dos `monthlyPlanItems` (ver `DOMAIN_MODEL.md §4.3`) e nunca armazenados denormalizados, para evitar drift.

### 2.5 `recurringRules`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | |
| `type` | String enum | `INCOME` \| `EXPENSE` |
| `description` | String | |
| `categoryId` | ObjectId | |
| `amountCents` | Int | |
| `investment` | Boolean | regra de investimento; exige `type=EXPENSE` (ADR-017) |
| `recurrenceType` | String enum | **`MONTHLY` apenas na V1** |
| `dayOfMonth` | Int | 1–31 (ajusta ao último dia se o mês for mais curto) |
| `startDate` / `endDate` | Date \| null | janela de validade |
| `active` | Boolean | |
| `deletedAt` / `deletedBy` | Date / ObjectId | |
| `createdAt` / `updatedAt` | Date | |

### 2.6 `draftTransactions` (Inbox — V1, parser único)

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | |
| `rawNotification` | String | payload bruto |
| `parsedData` | Object | resultado do parser |
| `confidence` | Float | 0–1 |
| `status` | String enum | `PENDING` \| `CONFIRMED` \| `IGNORED` |
| `clientEventId` | String | **idempotência** (ADR-006) |
| `createdAt` / `confirmedAt` | Date | |

### 2.7 `settings`

`userId`, `theme` (`light`\|`dark`\|`system`), `currency`, `language`, `timezone`, `backupFrequency`, `animationsEnabled`, `motionLevel`.

> **Convenção de enums:** todos os enums de domínio (`type`, `status`, `origin`, `kind`, `recurrenceType`) são **MAIÚSCULOS**. O único enum em minúsculas é `theme` (`light`/`dark`/`system`), intencionalmente, para casar com a convenção do `next-themes` no frontend. A seleção do `BackupProvider` **não** é um campo de settings — é definida por configuração de ambiente (dev = Local, prod = Object Storage); a coleção `backups` apenas registra em `providerType` qual foi usado.

### 2.8 `backups`

Apenas **metadados**. Os artefatos residem no destino gerenciado pelo `BackupProvider` (Local ou Object Storage), nunca presos ao filesystem efêmero. Campos: `userId`, `location`, `providerType`, `sizeBytes`, `checksum`, `createdAt`.

---

## 3. Índices (ADR-011 + refinamentos)

`transactions`
- `{ userId: 1, date: -1 }` — listagem e Home
- `{ userId: 1, year: 1, month: 1, status: 1 }` — agregações mensais (as três lentes)
- `{ userId: 1, categoryId: 1 }` — ranking de categorias
- `{ userId: 1, type: 1, status: 1 }` — filtros do dashboard
- `{ userId: 1, installmentGroupId: 1 }` — navegação de parcelas
- `{ userId: 1, origin: 1 }`
- todos combinados implicitamente com `deletedAt: null` via consultas de domínio

`recurringRules`
- `{ userId: 1, active: 1, dayOfMonth: 1 }`

`monthlyPlans`
- `{ userId: 1, year: 1, month: 1 }` — **único**

`draftTransactions`
- `{ userId: 1, status: 1, createdAt: -1 }`
- `{ userId: 1, clientEventId: 1 }` — **único** (barra duplicações da automação)

`categories`
- `{ userId: 1, archived: 1 }`

`users`
- `{ email: 1 }` — **único**

---

## 4. Relacionamentos e consistência

- Referências por `ObjectId` (não embutir Category em Transaction — categoria muda de nome/cor).
- `monthlyPlanItems` **embutido** em `monthlyPlans`: cardinalidade baixa, sempre lido em conjunto.
- Vínculo bidirecional plan↔transaction: `PlanItem.linkedTransactionId` e `Transaction.linkedPlanItemId`. A promoção `PENDING → PAID` é feita por serviço de domínio, transacionalmente quando possível.
- MongoDB não garante integridade referencial nativa; a coesão é responsabilidade dos repositories/serviços, cobertos por testes.

---

## 5. Evolução futura

- Novos `status` de transação, novos `recurrenceType` (WEEKLY/YEARLY) e `paymentMethod` entram por migração aditiva + RFC.
- Auditoria (FR-020) já é viável via soft delete; um histórico append-only pode ser adicionado sem reescrever o schema.
- A denormalização `month`/`year` é intencional e deve ser mantida coerente por hooks/serviço na escrita.
