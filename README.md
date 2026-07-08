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
  config/     # tsconfig compartilhado (ESLint/Prettier chegam na Fase 2)
docker/       # ambiente de containers (funcional a partir da Fase 4)
docs/         # especificação (contrato)
scripts/      # seed, migrations, backup manual (fases futuras)
```

## Comandos

Requisitos: Node >= 22 e pnpm 10.

```sh
pnpm install
pnpm build       # turbo run build
pnpm typecheck   # turbo run typecheck
pnpm lint        # turbo run lint
pnpm test        # turbo run test
```

## Estado atual

**Fase 1 — Esqueleto do monorepo** (ver `docs/IMPLEMENTATION_ROADMAP.md`). Apps e packages existem como stubs que compilam; nenhuma regra de negócio implementada.
