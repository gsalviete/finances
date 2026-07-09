/** Cliente REST tipado — o frontend NUNCA calcula indicadores (ARCHITECTURE §6). */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const TOKEN_KEY = 'finances.token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token === null) window.localStorage.removeItem(TOKEN_KEY);
  else window.localStorage.setItem(TOKEN_KEY, token);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string; details?: Record<string, unknown> };
    } | null;
    throw new ApiError(
      envelope?.error?.message ?? `Erro ${response.status}`,
      envelope?.error?.code ?? 'UNKNOWN',
      response.status,
      envelope?.error?.details ?? {},
    );
  }
  return (await response.json()) as T;
}

/** Requisições fora do JSON (export/import de backup). */
export async function apiRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string; details?: Record<string, unknown> };
    } | null;
    throw new ApiError(
      envelope?.error?.message ?? `Erro ${response.status}`,
      envelope?.error?.code ?? 'UNKNOWN',
      response.status,
      envelope?.error?.details ?? {},
    );
  }
  return response;
}
