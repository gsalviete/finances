import { Injectable } from '@nestjs/common';
import {
  clampDayToMonth,
  monthRangeUtc,
  startOfLocalDayUtc,
  type MonthlyPlan,
  type MonthRef,
  type RecurringRule,
} from '@finances/shared';
import { TransactionsRepository } from '../../transactions/repository/transactions.repository';
import { MonthlyPlansRepository } from '../repository/monthly-plans.repository';
import { RecurringRulesRepository } from '../repository/recurring-rules.repository';

/**
 * Virada de mês (DOMAIN §6.2) — idempotente e lazy, chaveada por (userId, year, month):
 * 1. snapshot já existe → não faz nada;
 * 2. arquiva meses anteriores (não destrutivo);
 * 3. gera o MonthlyPlan a partir das RecurringRules ativas (valores congelados, PENDING);
 * 4. materializa uma Transaction FORECAST por regra, com vínculo bidirecional;
 * 5. parcelas futuras já existem — nada é recriado.
 * Regra investment=true → item INVESTMENT + Transaction EXPENSE (ADR-017 / FR-013).
 */
@Injectable()
export class MonthRolloverService {
  constructor(
    private readonly plansRepository: MonthlyPlansRepository,
    private readonly rulesRepository: RecurringRulesRepository,
    private readonly transactionsRepository: TransactionsRepository,
  ) {}

  async ensureMonth(userId: string, ref: MonthRef): Promise<MonthlyPlan> {
    const existing = await this.plansRepository.findByMonth(userId, ref);
    if (existing !== null) return existing; // idempotência

    await this.plansRepository.archiveBefore(userId, ref);
    const rules = await this.rulesForMonth(userId, ref);

    let plan: MonthlyPlan;
    try {
      plan = await this.plansRepository.create({
        userId,
        year: ref.year,
        month: ref.month,
        archived: false,
        notes: '',
        monthlyPlanItems: rules.map((rule) => ({
          kind: rule.investment ? 'INVESTMENT' : rule.type,
          description: rule.description,
          amountCents: rule.amountCents, // congelado para o mês
          categoryId: rule.categoryId,
          status: 'PENDING',
          linkedTransactionId: null,
        })),
      });
    } catch (error) {
      // corrida entre duas requisições: o índice único decide; o perdedor relê
      const existingNow = await this.plansRepository.findByMonth(userId, ref);
      if (existingNow !== null) return existingNow;
      throw error;
    }

    // materializa FORECAST por regra (itens e regras compartilham a ordem de criação)
    for (const [index, rule] of rules.entries()) {
      const item = plan.monthlyPlanItems[index];
      if (!item) continue;
      const transaction = await this.transactionsRepository.create({
        userId,
        categoryId: rule.categoryId,
        type: rule.type, // investimento é EXPENSE (FR-013)
        status: 'FORECAST',
        amountCents: rule.amountCents,
        description: rule.description,
        date: startOfLocalDayUtc({
          year: ref.year,
          month: ref.month,
          day: clampDayToMonth(ref.year, ref.month, rule.dayOfMonth),
        }),
        origin: 'MANUAL',
        linkedPlanItemId: item.id,
      });
      await this.plansRepository.setItemLink(plan.id, item.id, transaction.id);
    }

    const fresh = await this.plansRepository.findByMonth(userId, ref);
    return fresh ?? plan;
  }

  /** Regras ativas cuja janela [startDate, endDate] intercepta o mês local. */
  private async rulesForMonth(userId: string, ref: MonthRef): Promise<RecurringRule[]> {
    const { start, end } = monthRangeUtc(ref);
    const active = await this.rulesRepository.listForUser(userId, true);
    return active.filter(
      (rule) =>
        (rule.startDate === null || rule.startDate < end) &&
        (rule.endDate === null || rule.endDate >= start),
    );
  }
}
