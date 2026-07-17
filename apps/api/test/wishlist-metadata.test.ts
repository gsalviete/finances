/**
 * Unit da extração de metadados (ADR-018 §2): parser puro (JSON-LD → OG → title),
 * conversão de preço para centavos sem float e SSRF guard.
 */
import {
  parsePriceToCents,
  parseProductMetadata,
} from '../src/modules/wishlist/product-metadata/html-metadata.parser';
import {
  assertAllowedUrlShape,
  assertPublicUrl,
  isPrivateAddress,
} from '../src/modules/wishlist/product-metadata/url-guard';

const BASE = 'https://loja.example.com/produto/123';

describe('parsePriceToCents — centavos inteiros, nunca float', () => {
  it.each([
    ['1234.56', 123456],
    ['1.234,56', 123456],
    ['R$ 89,90', 8990],
    ['89', 8900],
    ['1.234', 123400], // separador com 3 dígitos = milhar
    [4599.9, 459990],
    ['0,05', 5],
  ])('converte %p → %p', (raw, expected) => {
    expect(parsePriceToCents(raw)).toBe(expected);
  });

  it.each([
    ['', null],
    ['grátis', null],
    ['-10,00', null],
    ['0', null],
    [null, null],
    [undefined, null],
  ])('rejeita %p', (raw, expected) => {
    expect(parsePriceToCents(raw)).toBe(expected);
  });
});

describe('parseProductMetadata — JSON-LD tem precedência sobre OpenGraph', () => {
  const jsonLdPage = `<!doctype html><html><head>
    <title>Título da aba</title>
    <meta property="og:title" content="Nome OG" />
    <meta property="og:image" content="https://cdn.example.com/og.jpg" />
    <script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Fone XYZ",
       "image":["/img/fone.jpg"],"offers":{"@type":"Offer","price":"1299.90","priceCurrency":"BRL"}}]}
    </script></head><body></body></html>`;

  it('extrai nome, imagem (resolvida contra a página) e preço do JSON-LD', () => {
    const meta = parseProductMetadata(jsonLdPage, BASE);
    expect(meta).toEqual({
      name: 'Fone XYZ',
      imageUrl: 'https://loja.example.com/img/fone.jpg',
      priceCents: 129990,
      currency: 'BRL',
    });
  });

  it('cai para OpenGraph quando não há JSON-LD de Product', () => {
    const page = `<head><title>Aba</title>
      <meta property="og:title" content="Mouse ABC" />
      <meta property="og:image" content="https://cdn.example.com/mouse.jpg" />
      <meta property="product:price:amount" content="149,99" />
      <meta property="product:price:currency" content="brl" /></head>`;
    const meta = parseProductMetadata(page, BASE);
    expect(meta).toEqual({
      name: 'Mouse ABC',
      imageUrl: 'https://cdn.example.com/mouse.jpg',
      priceCents: 14999,
      currency: 'BRL',
    });
  });

  it('cai para <title> quando não há nada estruturado (PARTIAL)', () => {
    const meta = parseProductMetadata('<head><title>  Só o título </title></head>', BASE);
    expect(meta).toEqual({ name: 'Só o título', imageUrl: null, priceCents: null, currency: null });
  });

  it('página sem metadados vira tudo null (FAILED)', () => {
    expect(parseProductMetadata('<body><h1>oi</h1></body>', BASE)).toEqual({
      name: null,
      imageUrl: null,
      priceCents: null,
      currency: null,
    });
  });

  it('JSON-LD malformado não derruba a extração — usa o fallback', () => {
    const page = `<head><script type="application/ld+json">{invalido</script>
      <meta property="og:title" content="Fallback OG" /></head>`;
    expect(parseProductMetadata(page, BASE).name).toBe('Fallback OG');
  });

  it('imagem com esquema não-http é descartada', () => {
    const page = `<head><meta property="og:image" content="javascript:alert(1)" /></head>`;
    expect(parseProductMetadata(page, BASE).imageUrl).toBeNull();
  });

  it('usa microdados itemprop quando não há OG nem JSON-LD', () => {
    const page = `<head><title>x</title>
      <meta itemprop="name" content="Cadeira Gamer" />
      <meta itemprop="image" content="https://cdn.example.com/cadeira.jpg" />
      <meta itemprop="price" content="899.90" />
      <meta itemprop="priceCurrency" content="BRL" /></head>`;
    expect(parseProductMetadata(page, BASE)).toEqual({
      name: 'Cadeira Gamer',
      imageUrl: 'https://cdn.example.com/cadeira.jpg',
      priceCents: 89990,
      currency: 'BRL',
    });
  });

  it('cai para Twitter Cards quando OG está ausente', () => {
    const page = `<head><title>x</title>
      <meta name="twitter:title" content="Mochila X" />
      <meta name="twitter:image" content="https://cdn.example.com/mochila.jpg" /></head>`;
    const meta = parseProductMetadata(page, BASE);
    expect(meta.name).toBe('Mochila X');
    expect(meta.imageUrl).toBe('https://cdn.example.com/mochila.jpg');
  });
});

describe('parseProductMetadata — heurísticas para páginas sem dados estruturados (Amazon)', () => {
  it('extrai preço de a-offscreen e imagem de data-a-dynamic-image', () => {
    const page = `<html><head><title>Fone Bluetooth | Amazon.com.br</title></head><body>
      <img id="landingImage" data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/519.jpg&quot;:[355,355]}" />
      <span class="a-price"><span class="a-offscreen">R$ 119,90</span></span>
    </body></html>`;
    expect(parseProductMetadata(page, BASE)).toEqual({
      name: 'Fone Bluetooth', // sufixo "| Amazon.com.br" removido
      imageUrl: 'https://m.media-amazon.com/images/I/519.jpg',
      priceCents: 11990,
      currency: 'BRL',
    });
  });

  it('extrai preço de "priceAmount" e imagem de "hiRes" (JSON embutido)', () => {
    const page = `<head><title>Produto - Amazon</title></head><body>
      <script>var data = {"hiRes":"https://m.media-amazon.com/images/I/71x.jpg","priceAmount":249.9};</script>
    </body>`;
    const meta = parseProductMetadata(page, BASE);
    expect(meta.priceCents).toBe(24990);
    expect(meta.imageUrl).toBe('https://m.media-amazon.com/images/I/71x.jpg');
  });

  it('JSON-LD/OG têm precedência sobre a heurística (heurística é último recurso)', () => {
    const page = `<head>
      <meta property="og:image" content="https://cdn.example.com/og.jpg" />
      <meta property="product:price:amount" content="50,00" />
      <meta property="product:price:currency" content="BRL" /></head>
      <body><span class="a-offscreen">R$ 999,99</span></body>`;
    const meta = parseProductMetadata(page, BASE);
    expect(meta.priceCents).toBe(5000); // OG, não a-offscreen
    expect(meta.imageUrl).toBe('https://cdn.example.com/og.jpg');
  });
});

describe('cleanName — remove sufixo de marketplace sem mutilar o produto', () => {
  it.each([
    ['Fone XYZ | Amazon.com.br', 'Fone XYZ'],
    ['Geladeira Brastemp - Magazine Luiza', 'Geladeira Brastemp'],
    ['Mouse Gamer – Kabum', 'Mouse Gamer'],
  ])('%p → %p', (raw, expected) => {
    const page = `<head><title>${raw}</title></head>`;
    expect(parseProductMetadata(page, BASE).name).toBe(expected);
  });

  it('preserva "|" que faz parte legítima do nome (sem loja/domínio no sufixo)', () => {
    const page = `<head><title>Kit 2 em 1 | Preto</title></head>`;
    expect(parseProductMetadata(page, BASE).name).toBe('Kit 2 em 1 | Preto');
  });
});

describe('SSRF guard — o fetch nunca alcança rede privada (ADR-018 §2)', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.0.10',
    '169.254.1.1',
    '0.0.0.0',
    '100.64.0.1',
    '::1',
    'fd00::1',
    '::ffff:127.0.0.1',
  ])('classifica %s como privado', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '52.94.225.10', '2600:9000::1'])('classifica %s como público', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it.each(['ftp://example.com/x', 'file:///etc/passwd', 'https://example.com:8080/x', 'não é url'])(
    'rejeita a forma %s',
    (url) => {
      expect(() => assertAllowedUrlShape(url)).toThrow();
    },
  );

  it.each(['http://127.0.0.1/admin', 'http://[::1]/x', 'https://192.168.0.1/router'])(
    'rejeita IP literal privado %s',
    async (url) => {
      await expect(assertPublicUrl(url)).rejects.toMatchObject({
        response: expect.objectContaining({ reason: 'URL_NOT_ALLOWED' }),
      });
    },
  );

  it('rejeita hostname que resolve para loopback (localhost)', async () => {
    await expect(assertPublicUrl('http://localhost/x')).rejects.toMatchObject({
      response: expect.objectContaining({ reason: 'URL_NOT_ALLOWED' }),
    });
  });
});
