# PROJECT_SPEC.md

Version: 2.1.0
Status: Final — Architecture Gate Review PASSED
Project Codename: finances
Author: Gabriel Salviete

> Documento de **produto**. As regras de cálculo estão em `DOMAIN_MODEL.md`, a arquitetura em `ARCHITECTURE.md`, a persistência em `DATABASE.md` e o guia de implementação em `CLAUDE.md`. Esta versão incorpora as ADRs 001–015 e a decisão do número-herói (Saldo Projetado).

---

# 1. Visão

Finances responde, de forma rápida e confiável, a uma única pergunta:

> **Quanto eu ainda posso gastar até o final deste mês?**

Não compete com bancos, plataformas de investimento ou apps de educação financeira. É uma ferramenta de decisão diária: o usuário abre por poucos segundos e entende sua situação imediatamente.

**Objetivos:** reduzir ansiedade financeira, facilitar decisões de consumo, eliminar planilhas, minimizar cadastro manual, oferecer automações e indicadores simples, e preparar terreno para IA futura.

**Não objetivos:** Open Finance, sincronização bancária, investimentos/dividendos/patrimônio, IRPF, score, educação financeira, carteiras de ações/cripto, controle empresarial, múltiplos usuários (V1) e múltiplas moedas. Qualquer inclusão futura exige RFC.

---

# 2. Filosofia do produto (prioridade máxima)

Em qualquer conflito entre funcionalidade e filosofia, **a filosofia prevalece**.

1. Tudo contribui para responder "quanto ainda posso gastar?".
2. Nunca parecer um banco. Transmitir simplicidade, calma, clareza, produtividade — nunca burocracia ou linguagem corporativa.
3. Registrar um gasto leva menos de 10s (idealmente 5s).
4. Toda informação importante está na Home.
5. O dashboard apoia decisões; todo gráfico responde a uma pergunta ou é removido.
6. A IA nunca faz cálculos financeiros; toda regra vive no backend, a IA apenas interpreta.
7. Toda automação é revisável antes de afetar o orçamento.
8. O usuário controla seus dados: exportáveis, importáveis, restauráveis, sem depender da infraestrutura.
9. Projeto pessoal, qualidade de SaaS profissional.

---

# 3. Conceitos fundamentais

O sistema tem cinco conceitos, agora ancorados numa premissa única (ADR-015):

**Fonte única da verdade: a coleção `transactions`.** Planejamento representa intenção; Transactions representam tanto fatos quanto movimentações esperadas. A diferença é o campo `status`.

**Receita** — valor recebido (salário, bônus, PIX, reembolso, venda). **Despesa** — qualquer saída (aluguel, mercado, lazer, investimento). Investimento é despesa: ao ser separado, deixa o orçamento.

**Transação** — toda movimentação; é `INCOME` ou `EXPENSE`, sempre com categoria. Possui `status`: `FORECAST` (esperada), `CONFIRMED` (ocorreu) ou `CANCELLED`.

**Planejamento Mensal** — snapshot de intenção gerado a partir de regras recorrentes. **Não** entra no saldo; apenas descreve o mês e acompanha o progresso (`PENDING → PAID`).

**Categoria** — criada pelo usuário, nunca fixa, arquivável sem perda de histórico.

### As três lentes (a distinção central)

- **Saldo Projetado** (número-herói): `CONFIRMED + FORECAST`. É a resposta a "quanto posso gastar". Visualmente dominante.
- **Saldo Atual**: apenas `CONFIRMED`. O caixa honesto, para conferência.
- **Planejado**: derivado do snapshot de intenção. Referência de ritmo.

Nunca misturados. Fórmulas exatas em `DOMAIN_MODEL.md §4`.

---

# 4. Jornada do usuário

**Primeiro acesso:** criar usuário → moeda → tema → despesas recorrentes → receitas recorrentes → objetivo de investimento → finalizar.

**Início de novo mês (assistente):** confirmar receitas previstas → despesas recorrentes → investimento → resumo. Ao confirmar, o snapshot é gerado e as movimentações esperadas nascem como `FORECAST`. A partir daí o acompanhamento começa — e a Home já responde corretamente desde o dia 1º, porque o Saldo Projetado inclui as movimentações esperadas.

**Durante o mês:** registrar despesas/receitas, revisar automações pendentes na Inbox, consultar dashboard, editar planejamento, reconciliar previsto × realizado.

**Encerramento:** ao iniciar novo mês, o anterior é arquivado de forma não destrutiva. Nenhum dado é perdido; indicadores históricos permanecem.

---

# 5. Roadmap (reordenado)

**V1 — Núcleo utilizável**
Planejamento mensal · Dashboard (3 lentes) · Categorias · Transações (manual + parcelamento) · **Automação (parser único, ADR-008): endpoint idempotente + Inbox/DraftTransactions + Apple Shortcuts** · Backup/Export/Import · Temas Light/Dark/System · Responsividade · Docker · Deploy.
Segurança e Acessibilidade são **requisitos transversais da V1** (não adiados).

> **Sequência recomendada dentro da V1:** a automação é a parte mais frágil (formatos de notificação mudam sem aviso) e deve ser **implementada por último**, após o núcleo estar sólido e com amostras reais de notificação em mãos. Ela pertence à V1 por decisão explícita (ADR-008), mas não bloqueia o restante do núcleo. Se as amostras não estiverem disponíveis a tempo, pode escorregar para um fast-follow sem travar a V1.

**V2 — IA**
Assistente, insights, aprendizado de categorias, resumos, comparações, previsões, parser via LLM.

**V2.1 — Polimento**
Melhorias de UX, performance, refatorações, microinterações, animações.

> Mudanças relevantes vs. spec original: Segurança e Acessibilidade saíram da V2.1 e passaram a ser transversais da V1. A automação permanece na V1 (ADR-008), com escopo reduzido a um único parser e implementação ao final do ciclo para de-riscar.

---

# 6. Requisitos funcionais (consolidados)

Cada requisito exige testes automatizados. Onde a regra é de cálculo, a fonte é `DOMAIN_MODEL.md`.

**FR-001 Home Dashboard** — responde em <15s: quanto posso gastar, se estou acima do ritmo, gasto diário, projeção de encerramento, dias restantes, últimas movimentações, maiores categorias. Saldo Projetado sempre no topo e dominante; Saldo Atual disponível para conferência.

**FR-002 Saldo Projetado / Saldo Atual** — dois valores nomeados e nunca misturados (fórmulas em `DOMAIN_MODEL §4.1–4.2`). O Projetado é o herói.

**FR-003 Ritmo Financeiro** — compara consumo variável real vs. esperado linear; status Confortável/Dentro/Atenção/Crítico, parametrizável (`§5.2`).

**FR-004 Gasto Diário Recomendado** — `Saldo Projetado / dias restantes`; recalcula após qualquer transação (`§5.1`).

**FR-005 Projeção** — heurística linear determinística, sem IA (`§5.3`).

**FR-006 Últimas Movimentações** — categoria, descrição, valor, tipo, status, data; clique abre detalhes.

**FR-007 Categorias Mais Utilizadas** — ranking por gasto: nome, percentual, valor absoluto.

**FR-008 Planejamento Mensal** — todo mês tem um snapshot editável; alterações recalculam imediatamente.

**FR-009/010 Receitas Previstas/Confirmadas** — receita prevista é uma Transaction `FORECAST` (entra no Projetado); ao confirmar, vira `CONFIRMED` (entra no Atual). Não há segunda contagem.

**FR-011 Receitas Recorrentes** — `recurringRules` geram movimentações `FORECAST` na virada de mês; nunca confirmam sozinhas antes da data prevista.

**FR-012 Despesas Recorrentes** — idem, geram `FORECAST` e o item de plano correspondente (`PENDING`).

**FR-013 Investimentos** — valor tratado como despesa (`INVESTMENT` no plano, Transaction `EXPENSE`); ao confirmar, sai do orçamento. Sem acompanhamento de patrimônio.

**FR-014 Cadastro Manual** — tipo, categoria, valor, data, descrição.

**FR-015 Categoria Obrigatória** — nenhuma movimentação sem categoria.

**FR-016 Parcelamentos** — compra parcelada materializa N Transactions (parcela atual `CONFIRMED`, futuras `FORECAST`), com divisão exata de centavos (`§6.1`).

**FR-017 Cartão de Crédito** — o sistema **não** controla cartões (sem limite, fechamento, vencimento, múltiplos cartões, fatura automática). Controla apenas parcelas; a "fatura" de um mês é a soma das parcelas daquele mês. `paymentMethod` removido da V1.

**FR-018 Receitas Extraordinárias** — PIX, reembolsos, presentes: Transactions `CONFIRMED` que aumentam imediatamente o Atual e o Projetado.

**FR-019 Exclusão** — soft delete com confirmação.

**FR-020 Histórico/Auditoria** — soft delete desde a V1 viabiliza auditoria futura sem reescrever schema.

**FR-021–024 Categorias** — customizáveis, com nome/cor/ícone/status; nunca removidas fisicamente; arquiváveis e restauráveis.

**FR-025–030 Automação (V1, parser único — ADR-008)** — endpoint para Shortcuts, um parser (Inter ou genérico), Inbox de revisão, uso de regex com confirmação quando a confiança for baixa (nunca inventar valores), tolerância a falhas (reenvio) com idempotência via `clientEventId`. Nenhuma movimentação entra em `transactions` sem passar pela Inbox.

**FR-031–033 Backup** — export ZIP (transactions/categories/settings/monthlyPlans/recurringRules/metadata, sem dados sensíveis), import com estratégia de conflito explícita, backup automático via `BackupProvider` (nunca filesystem efêmero).

**FR-034–036 Temas** — Light/Dark/System, troca instantânea sem reload, design tokens (nenhuma cor hardcoded), com hint de tema para evitar flash.

---

# 7. Critérios gerais de aceite

Uma funcionalidade está concluída quando: implementada, documentada, testada, responsiva, **acessível**, funcional em ambos os temas, sem erros de TypeScript, sem warnings de ESLint e sem regressões.

---

# 8. Product Constitution

1. Nada é adicionado só porque outro app tem.
2. Todo indicador ajuda numa decisão.
3. O dashboard é compreendido em <15s.
4. Toda tela tem objetivo claro.
5. Toda ação importante tem confirmação.
6. Nenhuma automação cria movimentação definitiva sem revisão.
7. Todo cálculo é determinístico.
8. Toda funcionalidade tem documentação.
9. O sistema funciona 100% sem IA.
10. A IA nunca é dependência obrigatória.
11. O sistema permanece utilizável após anos de uso (milhares de transações por ano, com folga).
12. Toda decisão arquitetural prioriza simplicidade.
13. Código legível > otimização prematura.
14. UX > quantidade de funcionalidades.
15. O sistema transmite tranquilidade e clareza, nunca culpa ou julgamento.

> Ajuste vs. original: a meta irreal de "centenas de milhares de transações" foi substituída por um alvo realista, para evitar overengineering (Constitution #12).

---

# 9. Fora de escopo (V1)

Open Finance, sincronização bancária, OCR, PIX automático, importação de extratos, controle patrimonial, dividendos, carteira de investimentos, IRPF, multiempresa, multiusuário, gamificação, push, widgets desktop, Apple Watch/Wear, Alexa/Google Home. Qualquer coisa não descrita aqui está fora da V1.
