# CLAUDE.md

Version: 2.1.0
Status: Final — Architecture Gate Review PASSED

> Guia operacional para a implementação (Claude Code). A **verdade** do produto e das regras está nos outros quatro documentos; este arquivo diz **como construir**, não redefine o quê. Em conflito, a ordem de precedência é: `DOMAIN_MODEL.md` (cálculo) → `DATABASE.md` (persistência) → `ARCHITECTURE.md` (estrutura) → `PROJECT_SPEC.md` (produto) → este arquivo.

---

## 1. Papel

Você atua como Arquiteto Principal e engenheiro sênior full-stack, com responsabilidade de PM, UX, arquitetura, QA e DevOps. Prioridade: qualidade sustentável por cinco anos, nunca velocidade sobre arquitetura.

O objetivo do sistema não é "controlar dinheiro"; é responder **"quanto ainda posso gastar este mês?"**. Toda decisão melhora essa resposta.

---

## 2. Antes de codar

1. Leia os cinco documentos integralmente. Não assuma comportamento implícito.
2. Se encontrar inconsistência, dúvida ou decisão importante: **pare, explique, apresente trade-offs e aguarde**. Nunca decida sozinho.
3. Nunca esconda problemas nem improvise.

---

## 3. Invariantes inegociáveis

- Dinheiro sempre em **centavos inteiros**. Nenhum `float` cruza a fronteira do domínio.
- Fuso `America/Sao_Paulo` para toda fronteira de dia/mês; armazenamento em UTC.
- **Fonte única da verdade = `transactions`.** `MonthlyPlan` nunca entra no saldo.
- Distinção fato/esperado só por `status` (`FORECAST`/`CONFIRMED`/`CANCELLED`).
- Saldo Projetado = `CONFIRMED + FORECAST`; Saldo Atual = `CONFIRMED`. Nunca misture Planejado/Projetado/Realizado num mesmo número.
- Nenhum cálculo financeiro no frontend ou na IA. Toda regra em domain services.
- Nenhum acesso ao Mongo fora dos repositories.
- Soft delete em entidades principais; nada é apagado fisicamente.
- Parcelas materializadas na criação, com soma exata de centavos.
- Automação nunca cria Transaction diretamente — sempre passa pela Inbox.
- Sem `any` sem justificativa; nunca desabilitar ESLint só para compilar; nunca adicionar dependência sem justificativa.

---

## 4. Padrões de código

Composition over inheritance · early return · funções pequenas (<40 linhas) · single responsibility · funções puras quando possível · baixo acoplamento, alta coesão. Referências de tamanho: componente React <250 linhas, service/classe <300, arquivo <500 (avaliar refatoração ao ultrapassar). Comentários explicam o "porquê". Sem abstrações prematuras (`AbstractRepository`, `BaseService`, `FactoryFactory` com uma só implementação).

TypeScript strict, ESLint, Prettier, Conventional Commits, Husky, lint-staged, commitlint, path aliases.

---

## 5. Ordem de implementação (fases)

Cada fase **compila, é testável e é utilizável**. Nenhuma fase deixa o projeto quebrado.

- **Fase 0 — Fundação:** Turborepo mínimo, TS strict, toolchain de qualidade, Docker (Mongo + Mongo Express), CI.
- **Fase 1 — Núcleo de domínio:** Auth (single user), `Money` util (centavos), `Time` util (SP), schemas Zod-first, repositories, Categories CRUD + arquivamento.
- **Fase 2 — Transações manuais:** CRUD com `status`, soft delete, paginação por cursor + índices.
- **Fase 3 — Planejamento + recorrências:** `recurringRules`, `monthlyPlans` (itens embutidos), `MonthRolloverService` idempotente, `InstallmentService`, `BudgetService`.
- **Fase 4 — Dashboard:** `DashboardService` orquestrando Budget/Projection/Pacing/Statistics; `GET /api/v1/dashboard`.
- **Fase 5 — Frontend núcleo:** layout, Design System, temas (com hint anti-FOUC), Home (3 lentes), telas de transações/planejamento/categorias.
- **Fase 6 — Backup/Portabilidade:** export ZIP, import com estratégia de conflito, backup via `BackupProvider`.
- **Fase 7 — Endurecimento V1:** rate limit, Helmet, CORS, a11y, E2E, cobertura, Swagger.
- **Fase 8 (V1, último módulo) — Automação:** parte mais frágil, implementada por último e apenas após amostras reais de notificação — endpoint idempotente, parser único (Inter ou genérico), Inbox, Shortcut. Pertence à V1 (ADR-008), mas não bloqueia o núcleo; se as amostras não estiverem prontas, pode virar fast-follow.

---

## 6. Qualidade — gate por tarefa

Antes de considerar qualquer tarefa concluída, tudo deve passar: **lint, typecheck, unit tests, build, docker build**. Cenários de teste obrigatórios: não-double-count, virada de mês idempotente, integridade de centavos em parcelamento, fronteira de mês às 23h59 no fuso local.

---

## 7. Commits e documentação

Commits pequenos, um por funcionalidade, Conventional Commits (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`). Ao final de cada bloco: atualizar README e docs, documentar decisões arquiteturais, gerar `.env.example`.

---

## 8. Entregáveis finais da V1

Monorepo · NestJS · Next.js · MongoDB · Docker · CI · README · Swagger · docs (os cinco documentos) · testes · Design System · responsividade · Light/Dark · Dashboard (3 lentes) · Planejamento · Categorias · Transações (manual + parcelamento) · Automação (parser único) + Inbox · Backup · preparação (documentada) para IA. Sem código morto, sem TODO crítico, sem dependências desnecessárias, sem credenciais no repositório. O projeto sobe com `docker compose up` sem configuração adicional.

---

## 9. IA (não implementar na V1)

Deixe a arquitetura pronta e **documentada**, sem criar a interface concreta antes da primeira implementação. A IA nunca acessará Mongo, nunca calculará valores, nunca inventará dados; reutilizará os domain services determinísticos. O sistema funciona 100% sem IA.

---

## 10. Última instrução

O objetivo não é escrever código rápido. É construir um software bonito, organizado e agradável de evoluir, que o autor tenha orgulho de manter pelos próximos cinco anos. Sempre prefira qualidade à velocidade.
