import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  daysInMonth,
  monthYearOf,
  startOfLocalDayUtc,
  type Clock,
  type GetMonthlyPlanQuery,
  type MonthlyPlan,
  type MonthlyPlanItem,
  type MonthlyPlanItemInput,
  type MonthRef,
  type UpdateMonthlyPlanInput,
} from '@finances/shared';
import { CLOCK } from '../../../common/clock/clock.module';
import { TransactionsRepository } from '../../transactions/repository/transactions.repository';
import { TransactionsService } from '../../transactions/transactions.service';
import { MonthlyPlansRepository, type PlanItemDraft } from '../repository/monthly-plans.repository';
import { MonthRolloverService } from './month-rollover.service';

@Injectable()
export class PlanningService {
  constructor(
    private readonly plansRepository: MonthlyPlansRepository,
    private readonly transactionsRepository: TransactionsRepository,
    private readonly transactionsService: TransactionsService,
    private readonly rollover: MonthRolloverService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** GET /planning — mês corrente dispara a virada lazy (ARCHITECTURE §3). */
  async getPlan(userId: string, query: GetMonthlyPlanQuery): Promise<MonthlyPlan> {
    const current = monthYearOf(this.clock.now());
    const ref: MonthRef =
      query.year !== undefined && query.month !== undefined
        ? { year: query.year, month: query.month }
        : current;

    let plan: MonthlyPlan | null;
    if (ref.year === current.year && ref.month === current.month) {
      plan = await this.rollover.ensureMonth(userId, ref);
    } else {
      plan = await this.plansRepository.findByMonth(userId, ref);
    }
    if (plan === null) {
      throw new NotFoundException('Não existe snapshot para este mês (use POST /planning)');
    }
    await this.transactionsService.autoConfirmDue(userId); // lazy §6.3
    return this.syncItemStatuses(userId, plan);
  }

  /** POST /planning — gatilho manual equivalente ao lazy (qualquer mês). */
  async ensure(userId: string, ref: MonthRef): Promise<MonthlyPlan> {
    const plan = await this.rollover.ensureMonth(userId, ref);
    return this.syncItemStatuses(userId, plan);
  }

  /** PUT /planning — edita itens/notas (FR-008); itens PAID são imutáveis. */
  async updatePlan(userId: string, input: UpdateMonthlyPlanInput): Promise<MonthlyPlan> {
    const ref: MonthRef = { year: input.year, month: input.month };
    const stored = await this.plansRepository.findByMonth(userId, ref);
    if (stored === null) {
      throw new NotFoundException('Não existe snapshot para este mês (use POST /planning)');
    }
    await this.transactionsService.autoConfirmDue(userId);
    const plan = await this.syncItemStatuses(userId, stored);

    const { finalItems, transactionPatches, cancelledTransactionIds, newItemIndexes } =
      await this.reconcileItems(userId, plan, input.monthlyPlanItems);

    const replaced = await this.plansRepository.replaceItems(plan.id, finalItems, input.notes);
    if (replaced === null) {
      throw new NotFoundException('Snapshot não encontrado');
    }

    // novas intenções também materializam FORECAST (fonte única = transactions)
    for (const index of newItemIndexes) {
      const item = replaced.monthlyPlanItems[index];
      if (!item) continue;
      const transaction = await this.transactionsRepository.create({
        userId,
        categoryId: item.categoryId,
        type: item.kind === 'INCOME' ? 'INCOME' : 'EXPENSE', // INVESTMENT é despesa (FR-013)
        status: 'FORECAST',
        amountCents: item.amountCents,
        description: item.description,
        date: startOfLocalDayUtc({
          year: ref.year,
          month: ref.month,
          day: daysInMonth(ref.year, ref.month), // esperado até o fim do mês
        }),
        origin: 'MANUAL',
        linkedPlanItemId: item.id,
      });
      await this.plansRepository.setItemLink(replaced.id, item.id, transaction.id);
    }

    for (const patch of transactionPatches) {
      await this.transactionsRepository.updateForUser(patch.transactionId, userId, patch.set);
    }
    for (const transactionId of cancelledTransactionIds) {
      await this.transactionsRepository.updateForUser(transactionId, userId, {
        status: 'CANCELLED',
      });
    }

    const fresh = await this.plansRepository.findByMonth(userId, ref);
    return fresh ?? replaced;
  }

  /** PENDING→PAID deriva do status da Transaction vinculada (DOMAIN §3.4) — na leitura. */
  private async syncItemStatuses(userId: string, plan: MonthlyPlan): Promise<MonthlyPlan> {
    const linked = plan.monthlyPlanItems.filter((item) => item.linkedTransactionId !== null);
    if (linked.length === 0) return plan;

    const transactions = await this.transactionsRepository.findMany(
      { userId, _id: { $in: linked.map((item) => item.linkedTransactionId) } },
      { withDeleted: true },
    );
    const byId = new Map(transactions.map((t) => [t.id, t]));

    let dirty = false;
    for (const item of linked) {
      const transaction = item.linkedTransactionId ? byId.get(item.linkedTransactionId) : undefined;
      const paid =
        transaction !== undefined &&
        transaction.status === 'CONFIRMED' &&
        transaction.deletedAt === null;
      const desired = paid ? 'PAID' : 'PENDING';
      if (item.status !== desired) {
        await this.plansRepository.setItemStatus(plan.id, item.id, desired);
        dirty = true;
      }
    }
    if (!dirty) return plan;
    const fresh = await this.plansRepository.findByMonth(userId, {
      year: plan.year,
      month: plan.month,
    });
    return fresh ?? plan;
  }

  private async reconcileItems(
    userId: string,
    plan: MonthlyPlan,
    inputs: MonthlyPlanItemInput[],
  ): Promise<{
    finalItems: PlanItemDraft[];
    transactionPatches: Array<{ transactionId: string; set: Record<string, unknown> }>;
    cancelledTransactionIds: string[];
    newItemIndexes: number[];
  }> {
    const existingById = new Map(plan.monthlyPlanItems.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const finalItems: PlanItemDraft[] = [];
    const transactionPatches: Array<{ transactionId: string; set: Record<string, unknown> }> = [];
    const newItemIndexes: number[] = [];

    for (const [index, input] of inputs.entries()) {
      if (input.id === undefined) {
        await this.transactionsService.assertUsableCategory(userId, input.categoryId);
        newItemIndexes.push(index);
        finalItems.push({ ...input, status: 'PENDING', linkedTransactionId: null });
        continue;
      }
      const current = existingById.get(input.id);
      if (current === undefined || seen.has(input.id)) {
        throw new UnprocessableEntityException({
          message: 'Item de plano inexistente ou duplicado na edição',
          reason: 'PLAN_ITEM_NOT_FOUND',
        });
      }
      seen.add(input.id);
      const changed = this.itemChanged(current, input);
      if (changed && current.status === 'PAID') {
        throw new ConflictException({
          message: 'Item PAID é imutável: o compromisso já foi realizado',
          reason: 'PLAN_ITEM_PAID_IMMUTABLE',
        });
      }
      if (changed) {
        await this.transactionsService.assertUsableCategory(userId, input.categoryId);
        if (current.linkedTransactionId !== null) {
          transactionPatches.push({
            transactionId: current.linkedTransactionId,
            set: {
              amountCents: input.amountCents,
              description: input.description,
              categoryId: input.categoryId,
              type: input.kind === 'INCOME' ? 'INCOME' : 'EXPENSE',
            },
          });
        }
      }
      finalItems.push({
        id: current.id,
        kind: input.kind,
        description: input.description,
        amountCents: input.amountCents,
        categoryId: input.categoryId,
        status: current.status,
        linkedTransactionId: current.linkedTransactionId,
      });
    }

    const cancelledTransactionIds: string[] = [];
    for (const item of plan.monthlyPlanItems) {
      if (seen.has(item.id)) continue;
      if (item.status === 'PAID') {
        throw new ConflictException({
          message: 'Item PAID não pode ser removido do plano (compromisso realizado)',
          reason: 'PLAN_ITEM_PAID_IMMUTABLE',
        });
      }
      if (item.linkedTransactionId !== null) {
        cancelledTransactionIds.push(item.linkedTransactionId);
      }
    }

    return { finalItems, transactionPatches, cancelledTransactionIds, newItemIndexes };
  }

  private itemChanged(current: MonthlyPlanItem, input: MonthlyPlanItemInput): boolean {
    return (
      current.kind !== input.kind ||
      current.description !== input.description ||
      current.amountCents !== input.amountCents ||
      current.categoryId !== input.categoryId
    );
  }
}
