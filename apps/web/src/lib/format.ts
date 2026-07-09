/** Formatação na BORDA usando o Money de @finances/shared (MONOREPO §3). */
import { Money } from '@finances/shared';

export function formatCents(cents: number): string {
  return Money.fromCents(cents).format('pt-BR', 'BRL');
}

/** Entrada do usuário ("1234,56") → centavos, sem float (Money.fromDecimalString). */
export function parseDecimalToCents(input: string): number {
  return Money.fromDecimalString(input).cents;
}

export function centsToDecimalInput(cents: number): string {
  return Money.fromCents(cents).toDecimalString().replace('.', ',');
}

export function formatDate(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Data local (SP) de um instante — para inputs type=date. */
export function toDateInputValue(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Valor de input type=date ("2026-07-08") → instante (meia-noite SP ≈ 03:00Z). */
export function dateInputToIso(value: string): string {
  return `${value}T03:00:00.000Z`;
}
