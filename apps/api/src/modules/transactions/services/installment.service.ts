import { Injectable } from '@nestjs/common';
import {
  addMonthsToLocalDate,
  localDateOf,
  Money,
  startOfLocalDayUtc,
  type CreateInstallmentPurchaseInput,
  type Transaction,
} from '@finances/shared';
import { TransactionsRepository } from '../repository/transactions.repository';
import { TransactionsService } from '../transactions.service';

/**
 * Materialização de parcelas (DOMAIN §6.1):
 * - divisão EXATA de centavos: base = floor(total/N); primeiras `resto` parcelas +1;
 * - parcela 1 (mês da compra) nasce CONFIRMED — a compra ocorreu; futuras FORECAST;
 * - datas nos meses subsequentes, mesmo dia (clamp ao último dia do mês);
 * - parcelas são materializadas na criação, NUNCA calculadas em runtime;
 * - não existe conceito de "fatura".
 */
@Injectable()
export class InstallmentService {
  constructor(
    private readonly repository: TransactionsRepository,
    private readonly transactionsService: TransactionsService,
  ) {}

  async createPurchase(
    userId: string,
    input: CreateInstallmentPurchaseInput,
  ): Promise<Transaction[]> {
    await this.transactionsService.assertUsableCategory(userId, input.categoryId);

    const parts = Money.fromCents(input.totalAmountCents).splitEvenly(input.installmentTotal);
    const groupId = this.repository.newId();
    const purchaseLocalDate = localDateOf(input.date);

    const docs = parts.map((part, index) => ({
      userId,
      categoryId: input.categoryId,
      type: 'EXPENSE',
      status: index === 0 ? 'CONFIRMED' : 'FORECAST',
      amountCents: part.cents,
      description: input.description,
      date:
        index === 0
          ? input.date
          : startOfLocalDayUtc(addMonthsToLocalDate(purchaseLocalDate, index)),
      origin: 'MANUAL',
      installmentGroupId: groupId,
      installmentNumber: index + 1,
      installmentTotal: input.installmentTotal,
    }));

    return this.repository.createMany(docs);
  }
}
