import { Injectable } from '@nestjs/common';
import { Money, signedMoney, type Transaction } from '@finances/shared';
import { variableConfirmedSpendCents } from './pacing.service';

export interface ProjectionInput {
  currentCents: number;
  monthTransactions: Transaction[];
  elapsedDays: number;
  remainingDays: number;
}

export interface ProjectionResult {
  endOfMonthCents: number;
  dailyVariableAverageCents: number;
  remainingCommitmentsCents: number;
}

/**
 * Projeção de Encerramento (FR-005, DOMAIN §5.3) — heurística linear explícita,
 * determinística, sem IA:
 *   Projeção = SaldoAtual + compromissosRestantes − projeçãoVariávelRestante
 */
@Injectable()
export class ProjectionService {
  compute(input: ProjectionInput): ProjectionResult {
    const variable = variableConfirmedSpendCents(input.monthTransactions);
    const dailyAverage = input.elapsedDays > 0 ? variable / input.elapsedDays : 0;
    const projectedRemainingVariable = Math.round(dailyAverage * input.remainingDays);
    const remainingCommitments = Money.sum(
      input.monthTransactions.filter((t) => t.status === 'FORECAST').map(signedMoney),
    ).cents;

    return {
      endOfMonthCents: input.currentCents + remainingCommitments - projectedRemainingVariable,
      dailyVariableAverageCents: Math.round(dailyAverage),
      remainingCommitmentsCents: remainingCommitments,
    };
  }
}
