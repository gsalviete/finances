/**
 * Parse puro de metadados de produto (ADR-018 §2), sem rede e sem executar JS.
 * Ordem de precedência: JSON-LD schema.org/Product → OpenGraph → <title>.
 */
import { Parser } from 'htmlparser2';

export interface ExtractedMetadata {
  name: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  currency: string | null;
}

/**
 * Preço textual/numérico → centavos inteiros, sem float atravessar a fronteira:
 * a parte decimal é tratada como string. Aceita "1234.56", "1.234,56", "R$ 89,90".
 * Retorna null quando não há um valor positivo inequívoco.
 */
export function parsePriceToCents(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).replace(/[^\d.,-]/g, '');
  if (text === '' || text.includes('-')) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const separatorIndex = Math.max(lastComma, lastDot);

  let integerPart = text;
  let decimalPart = '';
  if (separatorIndex !== -1) {
    const candidate = text.slice(separatorIndex + 1);
    // 1–2 dígitos após o último separador = casa decimal; 3 = milhar ("1.234")
    if (candidate.length >= 1 && candidate.length <= 2 && /^\d+$/.test(candidate)) {
      integerPart = text.slice(0, separatorIndex);
      decimalPart = candidate;
    }
  }
  integerPart = integerPart.replace(/[.,]/g, '');
  if (!/^\d+$/.test(integerPart)) return null;

  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

interface JsonLdOffer {
  price?: string | number;
  lowPrice?: string | number;
  priceCurrency?: string;
}

interface JsonLdNode {
  '@type'?: string | string[];
  '@graph'?: unknown;
  name?: unknown;
  image?: unknown;
  offers?: unknown;
}

function isProductType(type: string | string[] | undefined): boolean {
  if (type === undefined) return false;
  const types = Array.isArray(type) ? type : [type];
  return types.some((entry) => typeof entry === 'string' && /(^|\/)Product$/.test(entry));
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstString(entry);
      if (found !== null) return found;
    }
    return null;
  }
  // schema.org/ImageObject: { "@type": "ImageObject", "url": "..." }
  if (typeof value === 'object' && value !== null && 'url' in value) {
    return firstString((value as { url: unknown }).url);
  }
  return null;
}

function findProductNode(value: unknown): JsonLdNode | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findProductNode(entry);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const node = value as JsonLdNode;
  if (isProductType(node['@type'])) return node;
  if (node['@graph'] !== undefined) return findProductNode(node['@graph']);
  return null;
}

function extractOffer(offers: unknown): JsonLdOffer | null {
  if (Array.isArray(offers)) {
    for (const entry of offers) {
      const found = extractOffer(entry);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof offers !== 'object' || offers === null) return null;
  const offer = offers as JsonLdOffer & { offers?: unknown };
  if (offer.price !== undefined || offer.lowPrice !== undefined) return offer;
  // AggregateOffer pode aninhar offers
  if (offer.offers !== undefined) return extractOffer(offer.offers);
  return null;
}

interface CollectedTags {
  metaByProperty: Map<string, string>;
  jsonLdBlocks: string[];
  title: string;
}

function collectTags(html: string): CollectedTags {
  const metaByProperty = new Map<string, string>();
  const jsonLdBlocks: string[] = [];
  let title = '';
  let insideJsonLd = false;
  let insideTitle = false;
  let currentBlock = '';

  const parser = new Parser(
    {
      onopentag(tagName, attributes) {
        if (tagName === 'meta') {
          const key = attributes.property ?? attributes.name ?? attributes.itemprop;
          const content = attributes.content;
          if (
            key !== undefined &&
            content !== undefined &&
            !metaByProperty.has(key.toLowerCase())
          ) {
            metaByProperty.set(key.toLowerCase(), content);
          }
        }
        // <link rel="image_src" href="..."> — imagem canônica de fallback
        if (
          tagName === 'link' &&
          attributes.rel?.toLowerCase() === 'image_src' &&
          attributes.href
        ) {
          if (!metaByProperty.has('link:image_src')) {
            metaByProperty.set('link:image_src', attributes.href);
          }
        }
        if (tagName === 'script' && attributes.type?.toLowerCase() === 'application/ld+json') {
          insideJsonLd = true;
          currentBlock = '';
        }
        if (tagName === 'title') insideTitle = true;
      },
      ontext(text) {
        if (insideJsonLd) currentBlock += text;
        if (insideTitle) title += text;
      },
      onclosetag(tagName) {
        if (tagName === 'script' && insideJsonLd) {
          insideJsonLd = false;
          jsonLdBlocks.push(currentBlock);
        }
        if (tagName === 'title') insideTitle = false;
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();

  return { metaByProperty, jsonLdBlocks, title: title.trim() };
}

/**
 * Heurísticas para páginas que NÃO expõem OpenGraph/JSON-LD (ex.: Amazon):
 * preço em `a-offscreen`/`priceAmount`, imagem em `data-a-dynamic-image`/`hiRes`.
 * São o último recurso, aplicadas só quando a extração estruturada falha.
 */
function heuristicPrice(html: string): { cents: number | null; currency: string | null } {
  // Amazon embute o valor numérico canônico em JSON: "priceAmount":119.90
  const amount = /"price(?:Amount|_amount|Value)?"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)"?/i.exec(html);
  if (amount !== null) {
    const cents = parsePriceToCents(amount[1]);
    if (cents !== null) return { cents, currency: /R\$/.test(html) ? 'BRL' : null };
  }
  // Preço exibido: <span class="a-offscreen">R$ 119,90</span> (primeiro que parseia)
  const displayed = html.matchAll(/class="a-offscreen"[^>]*>\s*([^<]+?)\s*</gi);
  for (const match of displayed) {
    const raw = match[1] as string;
    const cents = parsePriceToCents(raw);
    if (cents !== null) {
      return { cents, currency: /R\$/.test(raw) ? 'BRL' : null };
    }
  }
  return { cents: null, currency: null };
}

function heuristicImage(html: string): string | null {
  const hiRes =
    /"(?:hiRes|large|mainUrl|imageUrl)"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i.exec(
      html,
    );
  if (hiRes !== null) return (hiRes[1] as string).replace(/\\u002F/gi, '/');
  // data-a-dynamic-image="{&quot;https://.../img.jpg&quot;:[...]}" (Amazon)
  const dynamic = /data-a-dynamic-image="([^"]+)"/i.exec(html);
  if (dynamic !== null) {
    const decoded = (dynamic[1] as string).replace(/&quot;/g, '"');
    const firstUrl = /"(https?:\/\/[^"]+)"/.exec(decoded);
    if (firstUrl !== null) return firstUrl[1] as string;
  }
  return null;
}

/**
 * Remove o sufixo de marketplace do nome vindo do <title> ("… | Amazon.com.br",
 * "… - Magazine Luiza"). Conservador: só corta o último segmento e só quando ele
 * contém um domínio ou nome de loja conhecido — nunca mutila o nome do produto.
 */
const STORE_SUFFIX =
  /\s[|\-–—]\s[^|\-–—]*(?:\.com|\.br|amazon|mercado ?livre|magazine ?luiza|magalu|kabum|pichau|americanas|casas ?bahia|shopee|aliexpress)[^|\-–—]*$/i;

function cleanName(raw: string): string {
  return raw.replace(STORE_SUFFIX, '').trim();
}

/** Resolve URL de imagem possivelmente relativa contra a página de origem. */
function resolveImageUrl(candidate: string | null, baseUrl: string): string | null {
  if (candidate === null) return null;
  try {
    const resolved = new URL(candidate, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

export function parseProductMetadata(html: string, baseUrl: string): ExtractedMetadata {
  const { metaByProperty, jsonLdBlocks, title } = collectTags(html);

  let name: string | null = null;
  let imageUrl: string | null = null;
  let priceCents: number | null = null;
  let currency: string | null = null;

  for (const block of jsonLdBlocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch {
      continue; // JSON-LD malformado não derruba a extração
    }
    const product = findProductNode(parsed);
    if (product === null) continue;
    name = firstString(product.name);
    imageUrl = firstString(product.image);
    const offer = extractOffer(product.offers);
    if (offer !== null) {
      priceCents = parsePriceToCents(offer.price ?? offer.lowPrice);
      currency = typeof offer.priceCurrency === 'string' ? offer.priceCurrency : null;
    }
    break;
  }

  // Camada 2: OpenGraph / Twitter Cards / microdados itemprop.
  name ??=
    metaByProperty.get('og:title') ??
    metaByProperty.get('twitter:title') ??
    metaByProperty.get('name') ?? // itemprop="name"
    null;
  imageUrl ??=
    metaByProperty.get('og:image') ??
    metaByProperty.get('og:image:secure_url') ??
    metaByProperty.get('twitter:image') ??
    metaByProperty.get('image') ?? // itemprop="image"
    metaByProperty.get('link:image_src') ??
    null;
  priceCents ??= parsePriceToCents(
    metaByProperty.get('product:price:amount') ??
      metaByProperty.get('og:price:amount') ??
      metaByProperty.get('price') ?? // itemprop="price"
      metaByProperty.get('twitter:data1'),
  );
  currency ??=
    metaByProperty.get('product:price:currency') ??
    metaByProperty.get('og:price:currency') ??
    metaByProperty.get('pricecurrency') ?? // itemprop="priceCurrency"
    null;

  // Camada 3: heurísticas para páginas sem dados estruturados (Amazon etc.).
  if (priceCents === null) {
    const heuristic = heuristicPrice(html);
    priceCents = heuristic.cents;
    currency ??= heuristic.currency;
  }
  imageUrl ??= heuristicImage(html);

  name ??= title === '' ? null : title;

  return {
    name: name === null ? null : cleanName(name).slice(0, 200) || null,
    imageUrl: resolveImageUrl(imageUrl, baseUrl),
    priceCents,
    currency: currency !== null && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : null,
  };
}
