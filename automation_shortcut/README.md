# Testando a Automação no iPhone (Apple Shortcuts)

> Guia prático de teste, passo a passo, para montar o Atalho no iPhone e validar o fluxo
> `notificação → draft na Inbox → confirmação na web` de ponta a ponta.
> O contrato completo do endpoint está em [`docs/AUTOMATION_SHORTCUT.md`](../docs/AUTOMATION_SHORTCUT.md) —
> em caso de divergência, aquele documento é a fonte da verdade.

---

## 1. Pré-requisitos

1. **API e web rodando** na sua máquina:
   ```sh
   docker compose up   # ou: pnpm dev
   ```
   - API: `http://localhost:3001` · Web: `http://localhost:3000`
2. **iPhone e computador na mesma rede Wi‑Fi.** O Atalho vai chamar a API pelo IP da máquina (não `localhost`).
3. **Descobrir o IP do computador** (macOS):
   ```sh
   ipconfig getifaddr en0
   ```
   Anote como `BASE_URL`, ex.: `http://192.168.0.15:3001`.
4. **Usuário criado** (o app é single-user). Teste o login por curl antes de ir ao iPhone:
   ```sh
   curl -s -X POST http://localhost:3001/api/v1/auth/login \
     -H 'content-type: application/json' \
     -d '{"email":"SEU_EMAIL","password":"SUA_SENHA"}'
   ```
   Guarde o `accessToken` da resposta (validade padrão: 7 dias).

> **Smoke test antes do iPhone:** rode o curl da seção 8 do `docs/AUTOMATION_SHORTCUT.md`
> trocando `localhost` pelo IP da máquina. Se funcionar do próprio computador com o IP,
> qualquer falha no iPhone será do Atalho ou da rede — nunca da API.

## 2. Montar o Atalho (app Atalhos)

Crie um **Atalho normal** (aba "Atalhos" → `+`), não uma Automação — o iOS não expõe o
gatilho "ao receber notificação" para apps de banco. O teste é manual: você copia o texto
da notificação e roda o Atalho (2 toques). Ações, na ordem:

| #   | Ação (nome no app)              | Configuração                                                |
| --- | ------------------------------- | ----------------------------------------------------------- |
| 1   | **Obter Área de Transferência** | — (o texto da notificação virá copiado)                     |
| 2   | **Formatar Data**               | Data atual · formato personalizado `yyyy-MM-dd'T'HH-mm-ss`  |
| 3   | **Texto**                       | `shortcut-{Data Formatada}` → será o `clientEventId`        |
| 4   | **Obter Conteúdo do URL**       | ver detalhes abaixo                                         |
| 5   | **Obter Valor do Dicionário**   | chave `parsedData.amountCents` da resposta                  |
| 6   | **Mostrar Notificação**         | "Draft criado: {valor} centavos" (feedback visual do teste) |

Configuração da ação **Obter Conteúdo do URL** (passo 4):

- **URL:** `{BASE_URL}/api/v1/automation/notification`
- **Método:** `POST`
- **Cabeçalhos:**
  - `Authorization` → `Bearer SEU_TOKEN` (cole o `accessToken` do passo 1.4)
  - `Content-Type` → `application/json`
- **Corpo da Solicitação:** JSON com dois campos:
  - `rawNotification` → variável _Área de Transferência_
  - `clientEventId` → variável _Texto_ (passo 3)

> Para reexecutar a **mesma** captura sem duplicar, o ideal é um `clientEventId`
> determinístico (ex.: hash do texto + data com minuto). Para o teste manual, o
> timestamp do passo 2/3 é suficiente.

## 3. Roteiro de teste

1. Copie este texto no iPhone (simula a notificação do banco):
   ```
   Compra aprovada: R$ 45,99 em MERCADO PAGUE MENOS
   ```
2. Rode o Atalho. Resultado esperado: notificação local com `4599` centavos (HTTP 201).
3. Abra `http://{IP}:3000/inbox` e confira o draft **PENDING** com valor `R$ 45,99` e
   descrição `MERCADO PAGUE MENOS`.
4. Na Inbox, escolha uma categoria e **confirme**. Só então a despesa entra no orçamento
   (regra inviolável: automação nunca cria transação direto).
5. Confira a movimentação em `Transações` com origem de automação e o impacto no
   Saldo Projetado do dashboard.

### Casos de teste do parser

| Texto copiado                            | Parse esperado                  | `confidence` |
| ---------------------------------------- | ------------------------------- | ------------ |
| `Compra aprovada: R$ 45,99 em MERCADO X` | `4599` + `MERCADO X`            | `0.9`        |
| `Você pagou R$ 1.234,56 no POSTO SHELL`  | `123456` + `POSTO SHELL`        | `0.9`        |
| `Débito de R$ 12,50`                     | só `1250` (sem estabelecimento) | `0.6`        |
| `Seu cartão foi utilizado`               | nada extraído (draft "revisar") | `0.1`        |
| `R$ 200 em PADARIA DA ESQUINA`           | `20000` (sem centavos no texto) | `0.9`        |

O parser **nunca inventa** valor: nos casos `0.6`/`0.1`, complete os dados na Inbox antes
de confirmar (confirmar sem valor → `422 AMOUNT_REQUIRED`).

### Teste de idempotência (obrigatório)

Rode o Atalho **duas vezes** com o mesmo `clientEventId` (ex.: fixe temporariamente o
passo 3 com um texto literal `teste-idem-001`). Esperado: a segunda chamada devolve o
**mesmo** draft (mesmo `id`), e a Inbox continua com **um** item. Nunca há duplicação.

## 4. Problemas comuns

| Sintoma                             | Causa provável                                    | Correção                                                                              |
| ----------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `401 UNAUTHORIZED`                  | token expirado (7 dias) ou header mal formado     | refaça o login; confira o prefixo `Bearer `                                           |
| Timeout / "servidor não encontrado" | iPhone fora da rede, IP errado, firewall do macOS | valide com o smoke test da seção 1; libere o Node no firewall                         |
| `400 BAD_REQUEST`                   | JSON fora do contrato                             | veja `details.issues` na resposta; confira os nomes `rawNotification`/`clientEventId` |
| `429`                               | rate limit (300 req/min)                          | aguarde 1 minuto — provável loop no Atalho                                            |
| Draft sem valor                     | parser não reconheceu o formato                   | esperado para textos fora dos padrões da seção 3; complete na Inbox                   |

## 5. Segurança do teste

- O token no Atalho equivale à sua sessão: apague-o do Atalho ao terminar os testes.
- Não exponha a API fora da rede local sem HTTPS.
- Swagger com todos os contratos: `{BASE_URL}/api/docs`.
