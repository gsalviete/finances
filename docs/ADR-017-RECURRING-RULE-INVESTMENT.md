# ADR-017 — RecurringRule.investment: origem dos itens INVESTMENT do plano

Version: 1.0.0
Status: **Aceito** — ratificado por Gabriel em 2026-07-08 (checkpoint do batch, antes da Fase 14)
Data: 2026-07-08

---

## Contexto

`DOMAIN_MODEL §6.2` determina que a virada de mês materializa uma Transaction FORECAST por regra "(receita/despesa/**investimento**)" e o `monthlyPlanItem.kind` aceita `INVESTMENT`; porém `RecurringRule.type` (§3.5) só aceita `INCOME | EXPENSE` — não havia forma de uma regra gerar item de investimento. O onboarding ("objetivo de investimento", PROJECT_SPEC §4) pressupõe essa capacidade.

## Decisão

- `RecurringRule` ganha o campo **`investment: boolean`** (default `false`).
- `investment = true` é válido **apenas com `type = EXPENSE`** (FR-013: investimento é despesa) — validado no contrato.
- Na virada de mês (§6.2):
  - regra com `investment = true` → plan item `kind = INVESTMENT` e Transaction `FORECAST` com `type = EXPENSE`;
  - caso contrário → `kind = type` da regra.
- O enum `PlanItemKind` e o restante do contrato permanecem inalterados.

## Consequências

- `recurringRuleSchema` (Zod), schema Mongoose, inputs de criação/edição e Swagger ganham o campo numa única edição conceitual (ADR-014).
- Nenhum índice novo. Valores congelados até novo ADR.
