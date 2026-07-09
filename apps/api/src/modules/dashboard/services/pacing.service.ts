import { Injectable } from '@nestjs/common';
import type { PacingStatus, Transaction } from '@finances/shared';

export interface PacingInput {
  projectedCents: number;
  monthTransactions: Transaction[];
  daysInMonth: number;
  elapsedDays: number;
}

export interface PacingResult {
  expectedCents: number;
  actualCents: number;
  ratio: number | null;
  status: PacingStatus;
}

/** Gasto variável confirmado (DOMAIN §5): EXPENSE CONFIRMED sem linkedPlanItemId. */
export function variableConfirmedSpendCents(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.type === 'EXPENSE' && t.status === 'CONFIRMED' && t.linkedPlanItemId === null)
    .reduce((acc, t) => acc + t.amountCents, 0);
}

/**
 * Ritmo Financeiro (FR-003, DOMAIN §5.2) — heurística linear, rotulada como
 * estimativa. Faixas default (parametrizáveis no futuro): 0.85 / 1.05 / 1.30.
 */
@Injectable()
export class PacingService {
  compute(input: PacingInput): PacingResult {
    const actual = variableConfirmedSpendCents(input.monthTransactions);
    const pool = input.projectedCents + actual; // poolDiscricionario (§5)
    const expected = Math.round(pool * (input.elapsedDays / input.daysInMonth));
    if (expected <= 0) {
      return { expectedCents: expected, actualCents: actual, ratio: null, status: 'ON_TRACK' };
    }
    const ratio = actual / expected;
    return { expectedCents: expected, actualCents: actual, ratio, status: statusFor(ratio) };
  }
}

function statusFor(ratio: number): PacingStatus {
  if (ratio <= 0.85) return 'COMFORTABLE';
  if (ratio <= 1.05) return 'ON_TRACK';
  if (ratio <= 1.3) return 'ATTENTION';
  return 'CRITICAL';
}
