# ADR-018 — Wishlist com captura de preço/imagem via metadados da página

Version: 1.0.0
Status: **Aceito** — ratificado por Gabriel em 2026-07-16
Data: 2026-07-16

---

## Contexto

O contrato congelado da V1 define o sistema como exclusivamente focado em finanças pessoais (transações, planejamento, dashboard, automação, backup). Em 2026-07-16 Gabriel solicitou uma nova feature: uma **wishlist de produtos**, na qual ele cadastra o link de um produto e o sistema extrai automaticamente **nome, preço e imagem** da página. Nesta primeira versão a wishlist é **isolada** — não participa de nenhum cálculo financeiro, plano mensal ou saldo. Uma futura integração com o núcleo financeiro será objeto de nova feature/ADR.

Decisões ratificadas com Gabriel em 2026-07-16:
1. **Estratégia de extração:** metadados da página (OpenGraph + JSON-LD `schema.org/Product`) via fetch HTTP simples no backend. Sem headless browser.
2. **Atualização:** snapshot no cadastro + **botão de refresh** por item (re-scraping sob demanda). Sem jobs agendados nem histórico de preços.
3. **Modelo:** além de link, nome, preço e imagem, o item tem **prioridade**. Sem status comprado/arquivado, notas ou preço-alvo nesta versão (candidatos à fase de integração).

## Decisões

### 1. Nova coleção `wishlistItems`

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | |
| `url` | String | link original do produto (validado como URL http/https) |
| `name` | String | extraído (`og:title` / JSON-LD `name`) ou informado manualmente |
| `priceCents` | Int \| null | **centavos inteiros** (invariante global); `null` quando a extração falha e o usuário ainda não informou |
| `currency` | String | ISO 4217; default = `settings.currency` do usuário |
| `imageUrl` | String \| null | URL da imagem (`og:image` / JSON-LD `image`); não armazenamos o binário |
| `priority` | String enum | `HIGH` \| `MEDIUM` \| `LOW` (maiúsculos, convenção do DATABASE.md §2.7) |
| `scrapeStatus` | String enum | `OK` \| `PARTIAL` \| `FAILED` — resultado da última extração |
| `scrapedAt` | Date \| null | momento do último scraping bem-sucedido (via `Clock` injetado) |
| `deletedAt` | Date \| null | soft delete (padrão das entidades principais) |
| `createdAt` / `updatedAt` | Date | |

- Índice único novo: `{ userId: 1, deletedAt: 1, createdAt: -1 }` — listagem. Nenhum outro (cardinalidade baixa, regra da Fase 8).
- Schema Zod-first (`wishlistItemSchema` em `packages/shared`, ADR-014) → Mongoose + Swagger derivados.

### 2. `ProductMetadataService` (extração)

- Fetch HTTP no backend (sem browser), `User-Agent` de navegador comum, timeout de 10s, resposta limitada a 2MB, seguindo no máximo 3 redirects.
- Ordem de extração: JSON-LD `schema.org/Product` (`name`, `image`, `offers.price`/`priceCurrency`) → fallback OpenGraph (`og:title`, `og:image`, `product:price:amount`) → fallback `<title>`.
- Preço extraído é convertido para **centavos inteiros** na fronteira; ambiguidade de parse (ex.: separador decimal) resolve pela `priceCurrency` declarada; sem moeda declarada, assume a do usuário.
- Falha total ou parcial **não bloqueia o cadastro**: o item é salvo com `scrapeStatus = FAILED|PARTIAL` e o usuário edita os campos manualmente. O scraping é auxiliar, nunca fonte de verdade.
- **SSRF guard:** apenas `http(s)`, porta 80/443, e resolução DNS que não aponte para IP privado/loopback/link-local é aceita. URL da imagem passa pela mesma validação antes de ser exibida.
- Nenhum conteúdo da página é executado (sem JS); apenas parse de HTML estático (`node:` APIs + parser leve — decisão de biblioteca na implementação).

### 2.1 Impersonação de fingerprint TLS (revisão 2026-07-16)

Descoberto durante a validação: o `fetch` nativo do Node é bloqueado com **403** pela maioria dos grandes e-commerces BR (Magazine Luiza, Amazon, Mercado Livre, Pichau, Terabyte, Casas Bahia, Netshoes) — o bloqueio é por **fingerprint TLS/HTTP2** (JA3), não por User-Agent. A extração passa a usar `impit` (cliente HTTP com impersonação do handshake do Chrome). **Isto não viola a decisão "sem headless"**: continua sendo fetch HTTP simples, sem browser e sem executar JS — apenas o handshake imita um navegador. Redirects são tratados manualmente (`followRedirects: false`) para que o SSRF guard revalide cada salto.

**Cobertura de extração** ganhou três camadas, aplicadas em ordem: (1) JSON-LD `schema.org/Product`; (2) OpenGraph / Twitter Cards / microdados `itemprop`; (3) heurísticas para páginas sem dados estruturados (ex.: Amazon — preço em `a-offscreen`/`priceAmount`, imagem em `data-a-dynamic-image`/`hiRes`). O nome vindo de `<title>` tem o sufixo de marketplace removido.

**Limite conhecido:** sites que renderizam o preço só via JS (Mercado Livre, Magazine Luiza) entregam nome+imagem mas **não** o preço no HTML estático — o item fica `PARTIAL` e o usuário informa o preço manualmente. Renderização headless para cobrir esses casos fica fora do escopo desta fase (exigiria novo ADR).

### 3. API e UI

- Módulo NestJS `wishlist` (padrão dos demais: controller → service → repository; Mongo só no repository).
- Endpoints: `GET/POST /api/v1/wishlist`, `PATCH/DELETE /api/v1/wishlist/:id`, `POST /api/v1/wishlist/:id/refresh` (re-executa a extração e sobrescreve o snapshot).
- Página `/wishlist` no Next.js: grid de cards (imagem, nome, preço, prioridade, link externo), formulário de cadastro por URL com preview do resultado da extração, edição manual, refresh por item, ordenação por prioridade e data. Segue Design System, i18n (pt-BR/en-US), light/dark e motionLevel vigentes.

### 4. Fronteiras com o núcleo financeiro

- `wishlistItems` **não** participa de saldo, plano, dashboard ou automação. Nenhum domain service financeiro a referencia.
- `priceCents` usa a mesma convenção de centavos para que a futura integração (ex.: "transformar item comprado em transação") não exija migração.
- Export/import de backup **inclui** a coleção (portabilidade completa é invariante do produto).

## Consequências

- `PROJECT_SPEC` deixa de ser "exclusivamente transações"; o escopo ampliado fica registrado neste ADR — os docs base recebem nota apontando para cá quando tocados.
- Nova dependência de parser HTML no backend (justificada; escolha exata reportada como Decisão de Implementação).
- Roadmap ganha **Bloco I — Fase 26 (Wishlist)**, fora do escopo de hardening da Fase 25.
- Integração wishlist ↔ finances (comprado → transação, preço-alvo, histórico de preços) fica explicitamente **fora** desta fase; exigirá novo ADR.
