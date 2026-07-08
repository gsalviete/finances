# ADR-016 — Extensões do contrato de Category: sortOrder, expiresAt e exclusão em uso

Version: 1.0.0
Status: **Aceito** — ratificado por Gabriel em 2026-07-08 (Fase 10)
Data: 2026-07-08

---

## Contexto

O contrato original de `Category` (`DATABASE.md §2.2`, `DOMAIN_MODEL.md §3.3`, FR-021–024) define: `name`, `icon`, `color`, `active`, `archived`, soft delete e timestamps. Durante a Fase 10, três necessidades de produto foram ratificadas e não constavam no contrato congelado. Este ADR as formaliza; os documentos base recebem notas apontando para cá.

## Decisões

### 1. `sortOrder` — ordenação manual

- Novo campo `sortOrder: Int >= 0`, por usuário, controlando a ordem de exibição.
- Listagem padrão: `sortOrder` ascendente, com desempate por `name` (determinística).
- Na criação sem `sortOrder` explícito, a categoria entra **ao final** (`max(sortOrder) + 1` do usuário).
- **Sem índice novo**: a cardinalidade de categorias por usuário é baixa (dezenas); o índice `{userId, archived}` do contrato permanece o único (regra "não adicionar índices extras", Fase 8).

### 2. `expiresAt` — categorias temporárias

- Novo campo `expiresAt: Date | null`; `null` = categoria permanente.
- Categoria **expirada** (`expiresAt <= agora`, fuso do domínio) comporta-se como arquivada para fins de listagem/seleção: **não aparece por padrão**; recuperável via `?includeExpired=true`.
- O **histórico permanece íntegro**: transações existentes continuam referenciando a categoria expirada; nada é apagado ou mascarado em consultas históricas.
- Novas transações com categoria expirada são rejeitadas na criação (regra aplicada na Fase 11, junto do CRUD de transações).
- "Agora" vem sempre do `Clock` injetado (nunca `new Date()`), mantendo o determinismo dos testes.

### 3. Exclusão de categoria em uso é bloqueada

- `DELETE` (soft delete, ADR-010) de categoria referenciada por **qualquer transação não-deletada** (inclusive `CANCELLED`, que permanece no histórico) → **409 CONFLICT**, `details.reason = "CATEGORY_IN_USE"`, mensagem orientando o **arquivamento** (FR-023), que é o mecanismo correto para tirar uma categoria de circulação sem perder histórico.
- Categoria sem uso pode ser soft-deletada normalmente.

## Consequências

- `categorySchema` (Zod, fonte única — ADR-014), schema Mongoose e Swagger ganham os dois campos numa única edição conceitual.
- Índices permanecem os do `DATABASE.md §3` — nenhuma alteração.
- A Fase 11 (Transações) DEVE validar `expiresAt` na criação de transação.
- Valores congelados até novo ADR.
