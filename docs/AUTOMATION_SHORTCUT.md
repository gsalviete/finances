# Automação via Apple Shortcuts — Guia de Integração

Version: 1.0.0
Status: Documento operacional (Fase 24) — autocontido, pode ser compartilhado fora do repositório.
Público: quem for construir o Atalho do iPhone (ou uma IA auxiliando nisso).

---

## 1. O que a aplicação faz (contexto em 30 segundos)

**finances** é um app pessoal de decisão financeira que responde a uma única pergunta: *"quanto eu ainda posso gastar até o final deste mês?"*. O usuário registra despesas/receitas e o sistema calcula o **Saldo Projetado** (confirmado + esperado), ritmo de gasto e projeções.

A **automação** existe para eliminar digitação: quando o banco envia uma notificação de compra no iPhone ("Compra aprovada: R$ 45,99 em MERCADO X"), um Atalho (Apple Shortcuts) captura o texto e envia para a API. A notificação vira um **rascunho (draft) numa Inbox de revisão** — **nada entra no orçamento sem o usuário confirmar** (regra inviolável do produto). Na interface web, o usuário abre a Inbox, escolhe a categoria e confirma; só então a despesa é criada.

```
Notificação do banco (iPhone)
        │  Atalho (iOS Automation)
        ▼
POST /api/v1/automation/notification     ← idempotente
        │  parser extrai valor + estabelecimento (nunca inventa)
        ▼
Draft PENDING na Inbox  ──(usuário revisa na web)──► Transação confirmada
```

## 2. Endpoint de ingestão

```
POST {BASE_URL}/api/v1/automation/notification
Content-Type: application/json
Authorization: Bearer {TOKEN}
```

`BASE_URL` de desenvolvimento: `http://<ip-do-computador>:3001` (o iPhone precisa alcançar a máquina na mesma rede; em produção será HTTPS).

**Body:**

```json
{
  "rawNotification": "Compra aprovada: R$ 45,99 em MERCADO PAGUE MENOS",
  "clientEventId": "shortcut-2026-07-08T19-32-05-abc123"
}
```

| Campo | Regras |
|---|---|
| `rawNotification` | texto integral da notificação; 1–2000 caracteres |
| `clientEventId` | **identificador único por notificação** (1–200 chars). É a chave de idempotência: reenvios com o mesmo id NÃO duplicam nada |

**Resposta (201):**

```json
{
  "id": "6a4e...",
  "status": "PENDING",
  "parsedData": { "amountCents": 4599, "description": "MERCADO PAGUE MENOS" },
  "confidence": 0.9,
  "clientEventId": "shortcut-...",
  "createdAt": "2026-07-08T22:32:06.000Z",
  "confirmedAt": null
}
```

- `parsedData.amountCents`: valor em **centavos inteiros** (R$ 45,99 → `4599`). Pode estar **ausente** se o parser não identificou valor — ele nunca inventa.
- `confidence`: 0–1. `0.9` = valor+estabelecimento; `0.6` = só valor; `0.1` = nada extraído (a Inbox marca "revisar").

**Erros relevantes** (formato padrão `{"success":false,"error":{"message","code","details"}}`):

| HTTP | code | Situação |
|---|---|---|
| 401 | UNAUTHORIZED | token ausente/expirado |
| 400 | BAD_REQUEST | body fora do contrato (`details.issues` explica) |
| 429 | — | rate limit (300 req/min por padrão) |

## 3. Autenticação (como o Atalho obtém o token)

A API usa JWT Bearer (validade padrão: 7 dias — configurável). Para obter:

```
POST {BASE_URL}/api/v1/auth/login
Content-Type: application/json

{"email": "seu-email", "password": "sua-senha"}
```

Resposta: `{"accessToken": "eyJ...", "user": {...}}`.

**Estratégias no Atalho** (da mais simples à mais robusta):
1. **Token fixo**: fazer login uma vez (ex.: via curl), colar o `accessToken` numa variável de Texto do Atalho. Simples; expira em 7 dias.
2. **Login no próprio Atalho**: primeira ação faz o POST de login (credenciais em variável) e usa o `accessToken` da resposta no header seguinte. Sempre válido; a senha fica armazenada no Atalho — avalie o risco no seu dispositivo.

## 4. Idempotência e tolerância a falhas (importante para o Atalho)

- O iPhone pode ficar offline; o Atalho pode reexecutar. Por isso o `clientEventId` **deve ser determinístico por notificação** ou único por captura:
  - Boa opção: `hash` (MD5/SHA) do texto da notificação + data (`Formatar Data` com minuto) — reenvio da MESMA notificação não duplica;
  - Alternativa: UUID por execução (ação "Gerar UUID") — reexecuções da mesma captura duplicam, mas capturas distintas nunca colidem.
- Reenvio com `clientEventId` repetido → a API devolve **o draft já existente** (201, mesmo `id`). Nunca há duplicação (índice único no banco).
- Se a API estiver inacessível, o Atalho pode guardar o payload (ex.: em Notas/arquivo) e reenviar depois — a idempotência garante segurança no replay.

## 5. O que o parser entende hoje (parser genérico, V1)

- **Valor**: padrão `R$ 1.234,56` — aceita com/sem separador de milhar e com/sem centavos (`R$ 200` → 20000 centavos).
- **Estabelecimento**: texto após " em ", " no " ou " na " iniciando com letra maiúscula/dígito (3–60 chars).
- Exemplos que funcionam bem:
  - `Compra aprovada: R$ 45,99 em MERCADO X` → valor + descrição (0.9)
  - `Você pagou R$ 1.234,56 no POSTO SHELL` → valor + descrição (0.9)
  - `Débito de R$ 12,50` → só valor (0.6)
  - `Seu cartão foi utilizado` → nada (0.1; usuário completa na Inbox)
- Um parser específico do Banco Inter está previsto como evolução quando houver amostras reais das notificações (o contrato do endpoint NÃO muda).

## 6. Receita do Atalho (esqueleto sugerido)

No app **Atalhos** → aba **Automação** → **Nova Automação Pessoal**:

1. **Gatilho:** infelizmente o iOS não expõe "ao receber notificação" diretamente para apps de banco na Automação padrão. Alternativas usadas na prática:
   - *Automação por horário* + ação de revisar manualmente (menos útil); ou
   - **Compartilhamento manual**: um Atalho normal na Share Sheet — ao ver a notificação, o usuário seleciona/copia o texto e roda o Atalho (2 toques); ou
   - Apps de terceiros que repassam notificações (avaliar privacidade).
2. **Ações do Atalho:**
   - `Receber entrada` (texto) ou `Obter Área de Transferência`;
   - `Formatar Data` (data atual, formato ISO) → variável `agora`;
   - `Texto` → montar `clientEventId` (ex.: `shortcut-{agora}-{hash do texto}`);
   - `Obter conteúdo do URL`:
     - URL: `{BASE_URL}/api/v1/automation/notification`
     - Método: POST · Cabeçalhos: `Authorization: Bearer {TOKEN}`
     - Corpo da solicitação: JSON com `rawNotification` e `clientEventId`;
   - (opcional) `Mostrar notificação` com o valor extraído da resposta (`parsedData.amountCents`).
3. **Revisão:** abrir `{WEB_URL}/inbox` (web em `:3000`) para confirmar/ignorar os drafts.

## 7. Endpoints da Inbox (para referência)

Todos autenticados (`Authorization: Bearer`):

- `GET /api/v1/inbox` — drafts pendentes;
- `POST /api/v1/inbox/{id}/confirm` — body `{"categoryId": "...", "amountCents"?: int, "description"?: "...", "date"?: iso}` → cria a despesa **confirmada** (`origin: AUTOMATION`); sem valor parseado nem informado → `422 AMOUNT_REQUIRED`;
- `POST /api/v1/inbox/{id}/ignore` — descarta mantendo histórico;
- `PUT /api/v1/inbox/{id}` — ajusta `amountCents`/`description` sugeridos antes de confirmar;
- `DELETE /api/v1/inbox/{id}` — remove o draft.

## 8. Teste rápido via curl (antes de montar o Atalho)

```sh
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"SEU_EMAIL","password":"SUA_SENHA"}' | jq -r .accessToken)

curl -s -X POST http://localhost:3001/api/v1/automation/notification \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"rawNotification":"Compra aprovada: R$ 45,99 em MERCADO X","clientEventId":"teste-001"}'
```

Depois confira em `http://localhost:3000/inbox`.

## 9. Segurança

- Nunca exponha a API sem HTTPS fora da rede local; o token no Atalho equivale à sua sessão.
- O rate limit (300 req/min) protege contra loops acidentais do Atalho.
- O Swagger completo está em `{BASE_URL}/api/docs` para explorar qualquer contrato.
