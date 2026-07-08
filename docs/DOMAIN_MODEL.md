# DOMAIN_MODEL.md

Version: 2.1.0
Status: Final — Architecture Gate Review PASSED
Escopo: modelo de domínio, ciclo de vida das entidades e regras financeiras determinísticas.

> Este documento é a **fonte da verdade conceitual** do projeto.
> `DATABASE.md` descreve a persistência física; `ARCHITECTURE.md` descreve as camadas; `PROJECT_SPEC.md` descreve o produto.
> Sempre que houver conflito sobre **como um número é calculado**, este documento prevalece.

---

## 1. Princípio central (ADR-001 / ADR-015)

Existe **uma única fonte de verdade operacional**: a coleção `transactions`.

- `MonthlyPlan` representa **intenção** (um snapshot de planejamento). Nunca é somado ao saldo real.
- `transactions` representa **movimentações do domínio financeiro**, tanto realizadas quanto esperadas.
- A distinção entre "fato" e "esperado" é feita **exclusivamente** pelo campo `status`.

Nenhum valor é contabilizado duas vezes. Um item de planejamento e a transação que o realiza são o **mesmo compromisso** visto por lentes diferentes, ligados por referência — nunca somados juntos.

---

## 2. Convenções transversais

| Regra | Valor |
|---|---|
| Moeda | Inteiro em **centavos** (`amountCents`). Nunca `float`/`double`. (ADR-004) |
| Sinal | `amountCents` é sempre **magnitude positiva**. O `type` define o sinal na agregação. |
| Timezone | `America/Sao_Paulo`. Armazenamento em UTC; fronteiras de dia/mês calculadas no fuso local. (ADR-005) |
| Denormalização temporal | `month` e `year` gravados no momento da escrita, derivados no fuso local. |
| Exclusão | **Soft delete** em todas as entidades principais (`deletedAt`, `deletedBy`). (ADR-010) |

**Função de sinal** (usada em toda agregação):

```
signed(t) = +t.amountCents   se t.type == INCOME
signed(t) = −t.amountCents   se t.type == EXPENSE
```

---

## 3. Entidades

### 3.1 Transaction (agregado raiz)

A única fonte de verdade financeira.

| Campo | Descrição |
|---|---|
| `type` | `INCOME` \| `EXPENSE` |
| `status` | `FORECAST` \| `CONFIRMED` \| `CANCELLED` |
| `amountCents` | magnitude em centavos |
| `categoryId` | **obrigatório** (FR-015) |
| `date` | data da movimentação (UTC; apresentada em SP) |
| `month`, `year` | derivados de `date` no fuso local |
| `origin` | `MANUAL` \| `AUTOMATION` \| `IMPORT` |
| `linkedPlanItemId` | referência opcional a um item do MonthlyPlan (compromissos previsíveis) |
| `installmentGroupId` | agrupa parcelas da mesma compra |
| `installmentNumber` / `installmentTotal` | posição e total de parcelas |
| `deletedAt` / `deletedBy` | soft delete |

**Invariantes:**

1. Toda Transaction possui `categoryId`, `date` e `type`.
2. `amountCents` é sempre `> 0`. O frontend nunca envia valores negativos.
3. Uma Transaction `CANCELLED` **nunca** entra em nenhuma agregação financeira.
4. Uma Transaction com `linkedPlanItemId` é um **compromisso** (fixo/previsível); sem ele, é **variável/discricionária**. Essa distinção alimenta ritmo e projeção.

### 3.2 Ciclo de vida do `status`

```
        criação
          │
   ┌──────┴───────┐
   │              │
FORECAST      CONFIRMED
   │              │
   ├── auto/data ─┤   (parcelas e recorrências confirmam na data prevista)
   ├── manual ────┤   (usuário confirma antecipadamente)
   │              │
   └── CANCELLED ─┘   (usuário cancela; permanece no histórico, fora dos cálculos)
```

- **FORECAST** — movimentação esperada (recorrência, parcela futura, receita prevista, despesa planejada). Já entra no número-herói.
- **CONFIRMED** — movimentação que efetivamente ocorreu. Auto-confirmação de parcelas/recorrências acontece **na data prevista**, exceto se o usuário editou ou cancelou antes (ADR-009).
- **CANCELLED** — não ocorrerá; sai de todos os cálculos, mas permanece no histórico para auditoria.

### 3.3 Category

Totalmente customizável, nunca fixa (FR-021). Campos: `name`, `icon`, `color`, `active`, `archived`, `sortOrder` (ordem manual de exibição) e `expiresAt` (categoria temporária; `null` = permanente) — os dois últimos por ADR-016. Nunca é removida fisicamente — apenas arquivada (FR-023), com restauração possível (FR-024). Exclusão (soft delete) de categoria em uso por transações não-deletadas é bloqueada; arquivar é o mecanismo correto (ADR-016). Categoria expirada some das listagens padrão sem afetar o histórico.

### 3.4 MonthlyPlan (snapshot de intenção)

Gerado no início do mês a partir das `RecurringRules` ativas. Contém um array **embutido** `monthlyPlanItems` (ADR — array embutido, poucos itens, sempre lidos juntos).

Cada `monthlyPlanItem`:

| Campo | Descrição |
|---|---|
| `kind` | `INCOME` \| `EXPENSE` \| `INVESTMENT` |
| `description` | ex.: "Aluguel" |
| `amountCents` | valor congelado para o mês |
| `categoryId` | categoria associada |
| `status` | `PENDING` \| `PAID` |
| `linkedTransactionId` | a Transaction FORECAST/CONFIRMED que o realiza |

**Escopo dos plan items:** apenas **compromissos previsíveis** — aluguel, condomínio, internet, energia, assinatura, investimento, salário, bônus esperado. Categorias variáveis (mercado, lazer, restaurante, combustível, presentes) **nunca** viram plan item; existem apenas como Transactions.

**Invariante:** um `monthlyPlanItem` muda de `PENDING → PAID` quando sua Transaction vinculada passa a `CONFIRMED`. O plan item **nunca** é somado ao saldo — ele apenas descreve a intenção e o progresso.

### 3.5 RecurringRule (template persistente)

Fonte das recorrências (ADR-003). Um template, não uma movimentação.

| Campo | Descrição |
|---|---|
| `type` | `INCOME` \| `EXPENSE` |
| `investment` | booleano; `true` exige `type=EXPENSE` e gera plan item `INVESTMENT` na virada (ADR-017) |
| `description`, `categoryId`, `amountCents` | conteúdo da recorrência |
| `recurrenceType` | **apenas `MONTHLY` na V1** |
| `dayOfMonth` | dia previsto (1–31, ajustado ao último dia se necessário) |
| `startDate` / `endDate` | janela de validade |
| `active` | ativa/inativa |

Editar uma RecurringRule **nunca** altera meses passados — apenas influencia os snapshots futuros.

### 3.6 DraftTransaction (a Inbox) — V1 (parser único)

Coleção única que representa a Inbox (ADR-007 unificado). Movimentações vindas da automação entram aqui antes de virar Transaction. Campos: `rawNotification`, `parsedData`, `confidence`, `status` (`PENDING` \| `CONFIRMED` \| `IGNORED`), `clientEventId` (idempotência, ADR-006), `createdAt`, `confirmedAt`.

> **Escopo V1 (ADR-008):** a automação existe na V1, porém com **um único parser** (Banco Inter, ou um parser genérico caso o específico gere complexidade excessiva). A arquitetura de múltiplos parsers permanece preparada; novos bancos são adicionados incrementalmente sem alterar o contrato da Inbox.

### 3.7 Settings / User

`Settings` (com `userId`): `theme`, `currency`, `language`, `backupFrequency`, `animationsEnabled`, `motionLevel`, `timezone`. `User`: modelagem preparada para multiusuário, mas V1 opera com um único usuário.

---

## 4. As três lentes financeiras

O produto responde **"quanto ainda posso gastar até o fim do mês?"**. A resposta é o **Saldo Projetado**. O sistema expõe três valores, **nunca misturados** (ADR-002):

Para um mês `M` de um usuário `U`, seja `T` o conjunto de transações não-deletadas, não-`CANCELLED`, com `month/year == M`.

### 4.1 Saldo Projetado — número-herói

```
SaldoProjetado(M) = Σ signed(t)  para t ∈ T com status ∈ { CONFIRMED, FORECAST }
```

É a resposta à pergunta central: o que resta depois de todas as movimentações confirmadas **e esperadas**. Deve ser **visualmente dominante** na Home. Inclui receita esperada ainda não recebida (otimista por decisão explícita).

### 4.2 Saldo Atual — caixa honesto

```
SaldoAtual(M) = Σ signed(t)  para t ∈ T com status == CONFIRMED
```

O caixa real. Disponível para transparência e conferência. Nunca dominante.

### 4.3 Planejado — intenção congelada

```
PlanejadoDisponivel(M) = Σ(INCOME items) − Σ(EXPENSE items) − Σ(INVESTMENT items)
                         sobre monthlyPlanItems do snapshot de M
```

Vem do `MonthlyPlan`, não de `transactions`. Fixo no início do mês; serve de referência para o ritmo.

> No dia 1º, com recorrências recém-materializadas, `SaldoProjetado ≈ PlanejadoDisponivel`. Ao longo do mês, o gasto variável faz `SaldoProjetado` divergir do `Planejado` — essa divergência **é** o sinal de ritmo.

---

## 5. Indicadores derivados (determinísticos, sem IA)

Todos os cálculos abaixo são puros e determinísticos (Constitution #7). A IA, quando existir, apenas **explica** os resultados; nunca os produz.

Definições auxiliares (fuso `America/Sao_Paulo`):
`diasNoMes`, `diasDecorridos` (inclui hoje), `diasRestantes = diasNoMes − diasDecorridos + 1`.

`gastoVariavelConfirmado` = Σ `amountCents` de EXPENSE `CONFIRMED` **sem** `linkedPlanItemId`.

`poolDiscricionario(M)` = SaldoProjetado(M) + gastoVariavelConfirmado(M)
(reconstitui o pool discricionário do início do mês, já descontados os compromissos.)

### 5.1 Gasto Diário Recomendado (FR-004)

```
GastoDiarioRecomendado = max(0, SaldoProjetado) / diasRestantes
```

Como `SaldoProjetado` já desconta os compromissos FORECAST futuros, dividir pelos dias restantes dá o discricionário diário que não compromete as despesas fixas. Recalcula imediatamente após qualquer transação.

### 5.2 Ritmo Financeiro (FR-003)

```
consumoEsperado = poolDiscricionario × (diasDecorridos / diasNoMes)
consumoReal     = gastoVariavelConfirmado
ratio           = consumoReal / consumoEsperado        (se consumoEsperado > 0)
```

Faixas (parametrizáveis; defaults):

| ratio | Status |
|---|---|
| ≤ 0.85 | Confortável |
| 0.85 – 1.05 | Dentro do esperado |
| 1.05 – 1.30 | Atenção |
| > 1.30 | Crítico |

### 5.3 Projeção de Encerramento (FR-005)

```
mediaDiariaVariavel      = gastoVariavelConfirmado / diasDecorridos      (se > 0)
projecaoVariavelRestante = mediaDiariaVariavel × diasRestantes
compromissosRestantes    = Σ signed(t) para t ∈ T, status == FORECAST    (líquido; inclui receita esperada)

ProjecaoEncerramento = SaldoAtual + compromissosRestantes − projecaoVariavelRestante
```

Heurística linear explícita. Não usa IA. A IA poderá, no futuro, apenas explicar o número.

> **Nota de honestidade epistêmica:** ritmo e projeção assumem gasto variável linear. Fins de semana, quinzena e sazonalidade não são modelados na V1. Os indicadores devem ser rotulados como estimativas, nunca como certezas.

---

## 6. Operações de domínio

### 6.1 Materialização de parcelas (ADR-009)

Ao criar uma compra parcelada com `installmentTotal = N`:

1. `base = floor(total / N)`; `resto = total − base × N`.
2. As **primeiras `resto` parcelas** recebem `base + 1`; as demais recebem `base`.
   → Garante `Σ parcelas == total` **exatamente** (integridade em centavos).
3. Gera `N` Transactions com `installmentGroupId` comum, `installmentNumber` de 1 a `N`.
4. Parcela do mês corrente → `CONFIRMED` (a compra ocorreu). Parcelas futuras → `FORECAST`.
5. Datas: cada parcela no mês subsequente, mesmo dia.

Não existe conceito de "fatura". A fatura de um mês é apenas a soma das parcelas daquele mês.

### 6.2 Virada de mês (idempotente)

Disparada de forma lazy no primeiro acesso do mês (ou por job). Chaveada por `(userId, year, month)`:

1. Se já existe snapshot de `M`, **não faz nada** (idempotência).
2. Arquiva o mês anterior de forma **não destrutiva** (`archived = true`). Nenhum dado é perdido.
3. Gera o `MonthlyPlan` de `M` a partir das `RecurringRules` ativas, congelando valores em `monthlyPlanItems` (`status = PENDING`).
4. Materializa uma Transaction `FORECAST` por regra (receita/despesa/investimento), com `linkedPlanItemId` apontando para o item, datada no `dayOfMonth` (fuso local).
5. Parcelas futuras já foram materializadas na compra — **não recria nada**.

**Compromissos não confirmados no fechamento:** FORECAST que nunca virou CONFIRMED permanece como FORECAST no mês histórico (discrepância visível), **sem mutação automática**. A tela de reconciliação destaca o item para o usuário decidir.

### 6.3 Confirmação automática

Um job diário (ou verificação lazy) promove `FORECAST → CONFIRMED` quando a `date` chega, **exceto** se o usuário editou ou cancelou o item antes. A edição manual sempre prevalece.

---

## 7. Regras de negócio invioláveis

1. Toda movimentação possui categoria e data.
2. O frontend nunca envia valores negativos; o `type` define o sinal.
3. Parcelas são **materializadas** na criação, nunca calculadas em runtime.
4. Nenhum cálculo financeiro ocorre no frontend nem na IA.
5. Qualquer alteração de planejamento ou transação é refletida **imediatamente na leitura seguinte**: Saldo Projetado, Saldo Atual, Gasto Diário, Ritmo, Projeção e estatísticas de categoria são calculados em **tempo de leitura**, sem cache nem valor derivado armazenado (não há recomputação em escrita).
6. Todo cálculo é determinístico e reproduzível.
7. Planejamento nunca entra no saldo; apenas Transactions entram.
