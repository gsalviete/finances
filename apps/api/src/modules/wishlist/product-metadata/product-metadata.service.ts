/**
 * Extração de metadados de produto (ADR-018 §2): fetch HTTP simples (sem browser,
 * sem executar JS), porém com impersonação de fingerprint TLS/HTTP2 do Chrome —
 * sem ela, os anti-bots dos grandes e-commerces (CloudFront/Akamai) respondem 403
 * ao fingerprint do Node, e a extração falhava para quase todos os sites reais.
 * Timeout de 10s, corpo limitado a 2MB, no máximo 3 redirects — cada salto
 * revalidado pelo SSRF guard. Falha NUNCA propaga para o cadastro: o chamador
 * recebe metadados vazios e decide o `scrapeStatus`.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Impit } from 'impit';
import { parseProductMetadata, type ExtractedMetadata } from './html-metadata.parser';
import { assertPublicUrl } from './url-guard';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export const EMPTY_METADATA: ExtractedMetadata = {
  name: null,
  imageUrl: null,
  priceCents: null,
  currency: null,
};

interface ImpitResponse {
  status: number;
  headers: { get(name: string): string | null };
  bytes(): Promise<Uint8Array>;
}

@Injectable()
export class ProductMetadataService {
  private readonly logger = new Logger(ProductMetadataService.name);

  // Redirects tratados manualmente para revalidar cada salto no SSRF guard.
  private readonly client = new Impit({
    browser: 'chrome',
    followRedirects: false,
    timeout: FETCH_TIMEOUT_MS,
  });

  /**
   * Busca a página e extrai os metadados. Erros de rede/bloqueio viram
   * metadados vazios (extração é auxiliar, nunca fonte de verdade).
   */
  async extract(rawUrl: string): Promise<ExtractedMetadata> {
    try {
      const page = await this.fetchHtml(rawUrl);
      if (page === null) return EMPTY_METADATA;
      return parseProductMetadata(page.html, page.finalUrl);
    } catch (error) {
      this.logger.warn(`extração falhou para ${rawUrl}: ${(error as Error).message}`);
      return EMPTY_METADATA;
    }
  }

  private async fetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string } | null> {
    let currentUrl = rawUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const url = await assertPublicUrl(currentUrl); // cada salto revalidado (SSRF)
      const response = (await this.client.fetch(url.toString(), {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
      })) as unknown as ImpitResponse;

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location === null) return null;
        currentUrl = new URL(location, url).toString();
        continue;
      }

      if (response.status < 200 || response.status >= 300) return null;

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType !== '' && !contentType.includes('html') && !contentType.includes('xml')) {
        return null;
      }

      const html = await this.readBodyCapped(response);
      return html === null ? null : { html, finalUrl: url.toString() };
    }
    return null; // excedeu redirects
  }

  /** Lê o corpo respeitando o teto de bytes — página gigante não derruba a API. */
  private async readBodyCapped(response: ImpitResponse): Promise<string | null> {
    const bytes = await response.bytes();
    const capped = bytes.byteLength > MAX_BODY_BYTES ? bytes.subarray(0, MAX_BODY_BYTES) : bytes;
    return Buffer.from(capped).toString('utf-8');
  }
}
