# ADR-014 — Schema-first: todos os contratos derivam do Schema

Version: 1.0.0
Status: **Aceito** — formaliza decisão já implícita no projeto (`ARCHITECTURE.md §1`, Fase 6 do `IMPLEMENTATION_ROADMAP.md`)
Data: 2026-07-08

---

## Contexto

O sistema tem um único modelo de domínio (DOMAIN_MODEL.md) consumido por camadas distintas: validação de entrada, tipos TypeScript, DTOs da API, documentação OpenAPI, serialização/parsing, persistência (Mongoose), frontend e, futuramente, IA. Sem uma fonte única, cada camada tende a redeclarar o mesmo conceito (interface + DTO + schema de validação + schema de banco), e as cópias divergem silenciosamente — a forma mais comum de drift em projetos de longa vida.

`ARCHITECTURE.md §1` já estabelece: *"os schemas Zod são a verdade. Tipos TS derivam via `z.infer`; a validação de DTO no NestJS deriva do mesmo schema; o schema Mongoose é escrito a partir da mesma forma."* Este ADR torna essa regra explícita, nomeada e vinculante.

## Decisão

**O Schema (Zod, em `packages/shared/src/schemas`) é a única fonte da verdade de todos os contratos do sistema.** Dele derivam:

- **validação** (runtime, em toda borda de entrada);
- **tipos TypeScript** (`z.infer`, nunca interfaces manuais paralelas);
- **DTOs** (derivações por `pick`/`omit`/`extend` do schema da entidade);
- **OpenAPI/Swagger** (gerado a partir dos schemas — Fase 7);
- **serialização e parsing** (o que entra e sai do sistema passa pelo schema);
- **frontend** (consome os tipos inferidos de `@finances/shared`);
- **backend** (DTOs NestJS e schemas Mongoose escritos a partir da mesma forma);
- **IA / Structured Output** (V2: JSON Schema derivado dos mesmos schemas).

O fluxo é sempre unidirecional:

```
Schema (Zod)
   ↓  z.infer
TypeScript
```

**Nunca o contrário.** Um tipo TypeScript jamais é a origem de um schema.

## Regras vinculantes

1. **Nenhuma interface ou `type` duplicando um conceito que possui schema.** Se o conceito existe em `packages/shared/src/schemas`, o tipo vem de `z.infer`.
2. **Nenhum enum duplicado.** Valores de enum vivem uma única vez (arrays `as const` + `z.enum`); proibido o keyword `enum` do TS para conceitos de domínio.
3. **DTOs são derivações**, nunca redeclarações: `schema.pick(...)`, `schema.omit(...)`, `schema.extend(...)`.
4. **Schemas Mongoose são escritos a partir da mesma forma** (o Mongoose não é inferível mecanicamente do Zod sem dependência extra); a coerência é garantida por testes na camada de persistência (Fase 8).
5. **Uma mudança de campo = uma edição conceitual** em `packages/shared`. Se uma mudança exigir editar o mesmo conceito em dois lugares, a estrutura está errada e deve ser corrigida.
6. **Exceções permitidas:** tipos utilitários não-contratuais (helpers internos, generics de infraestrutura) e value objects com invariantes comportamentais (`Money`, `Clock`) — que são classes/interfaces próprias, mas cujas **bordas** (ex.: `amountCents`) são validadas por schema.

## Consequências

**Positivas:** impossibilita drift entre validação, tipos, API e banco; refatorações de contrato ficam atômicas; OpenAPI e Structured Output (IA) saem "de graça" dos mesmos schemas; o frontend nunca inventa forma de dado.

**Negativas (aceitas):** acoplamento de todo o monorepo ao Zod (mitigado: dependência única, madura, e restrita a `packages/shared`); o schema Mongoose exige disciplina manual + testes de coerência (regra 4).

## Referências

- `ARCHITECTURE.md §1` (packages/shared como fonte única de schema)
- `IMPLEMENTATION_ROADMAP.md` Fase 6 (aceite: "uma mudança de campo exige uma edição conceitual")
- `DATABASE.md §2` (convenção de enums MAIÚSCULOS; exceção `theme` minúsculo)
