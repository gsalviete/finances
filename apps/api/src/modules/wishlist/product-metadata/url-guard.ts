/**
 * SSRF guard (ADR-018 §2): o servidor faz fetch de URL arbitrária colada pelo
 * usuário — nunca pode alcançar a rede interna. Aceita apenas http(s) na porta
 * padrão (80/443) e hosts cuja resolução DNS aponte só para IPs públicos.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { BadRequestException } from '@nestjs/common';

function rejection(message: string): BadRequestException {
  return new BadRequestException({ message, reason: 'URL_NOT_ALLOWED' });
}

/** IPv4 privado/reservado: loopback, RFC-1918, link-local, 0.0.0.0/8, CGNAT. */
function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC 6598)
  return false;
}

/** IPv6 privado/reservado: loopback, ULA, link-local e IPv4 mapeado. */
function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9')) return true; // link-local
  if (normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped !== null) return isPrivateIpv4(mapped[1] as string);
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true; // não é IP → nunca deveria chegar aqui; falha fechado
}

/** Valida forma da URL sem tocar a rede (protocolo/porta). Lança 400 se inválida. */
export function assertAllowedUrlShape(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw rejection('url inválida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw rejection('apenas URLs http(s) são aceitas');
  }
  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    throw rejection('apenas as portas 80 e 443 são aceitas');
  }
  return url;
}

/** Valida forma + resolução DNS: todo endereço resolvido deve ser público. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const url = assertAllowedUrlShape(rawUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // IPv6 literal vem entre colchetes

  if (isIP(hostname) !== 0) {
    if (isPrivateAddress(hostname)) throw rejection('endereço privado não é permitido');
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw rejection('host da url não pôde ser resolvido');
  }
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw rejection('endereço privado não é permitido');
  }
  return url;
}
