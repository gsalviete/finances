import { Injectable } from '@nestjs/common';
import { Money, signedMoney, type MonthRef, type Transaction } from '@finances/shared';
import { MonthlyPlansRepository } from '../../planning/repository/monthly-plans.repository';
import { TransactionsRepository } from '../../transactions/repository/transactions.repository';

export interface BudgetLenses {
  /** Saldo Projetado (DOMAIN §4.1) — CONFIRMED + FORECAST. O número-herói. */
  projectedCents: number;
  /** Saldo Atual (DOMAIN §4.2) — apenas CONFIRMED. */
  currentCents: number;
  /** Planejado (DOMAIN §4.3) — derivado do snapshot; null sem snapshot. */
  plannedCents: number | null;
  /** Transações não-canceladas do mês (reuso pelos demais serviços — leitura única). */
  monthTransactions: Transaction[];
}

/**
 * As três lentes (ADR-002): calculadas em TEMPO DE LEITURA a partir de
 * `transactions` (fonte única). Nada é somado duas vezes: plan items nunca
 * entram no saldo; CANCELLED e deletadas ficam fora por construção.
 */
@Injectable()
export class BudgetService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly plansRepository: MonthlyPlansRepository,
  ) {}

  async computeLenses(userId: string, ref: MonthRef): Promise<BudgetLenses> {
    const monthTransactions = await this.transactionsRepository.findMany({
      userId,
      year: ref.year,
      month: ref.month,
      status: { $in: ['CONFIRMED', 'FORECAST'] },
    });

    const projected = Money.sum(monthTransactions.map(signedMoney));
    const current = Money.sum(
      monthTransactions.filter((t) => t.status === 'CONFIRMED').map(signedMoney),
    );

    const plan = await this.plansRepository.findByMonth(userId, ref);
    const planned =
      plan === null
        ? null
        : plan.monthlyPlanItems.reduce(
            (acc, item) =>
              item.kind === 'INCOME'
                ? acc.add(Money.fromCents(item.amountCents))
                : acc.subtract(Money.fromCents(item.amountCents)),
            Money.zero(),
          ).cents;

    return {
      projectedCents: projected.cents,
      currentCents: current.cents,
      plannedCents: planned,
      monthTransactions,
    };
  }
}
