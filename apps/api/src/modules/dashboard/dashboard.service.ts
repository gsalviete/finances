import { Inject, Injectable } from '@nestjs/common';
import {
  dashboardResponseSchema,
  daysInMonth,
  localDateOf,
  monthYearOf,
  type Clock,
  type DashboardQuery,
  type DashboardResponse,
  type MonthRef,
} from '@finances/shared';
import { CLOCK } from '../../common/clock/clock.module';
import { PlanningService } from '../planning/services/planning.service';
import { TransactionsRepository } from '../transactions/repository/transactions.repository';
import { TransactionsService } from '../transactions/transactions.service';
import { BudgetService } from './services/budget.service';
import { CategoryStatisticsService } from './services/category-statistics.service';
import { PacingService } from './services/pacing.service';
import { ProjectionService } from './services/projection.service';

/**
 * Orquestrador puro (ARCHITECTURE §2.5): compõe os domain services e devolve o
 * DTO único. Nenhum cálculo próprio; tudo em tempo de leitura, sem cache (§2.6).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly budgetService: BudgetService,
    private readonly pacingService: PacingService,
    private readonly projectionService: ProjectionService,
    private readonly categoryStatisticsService: CategoryStatisticsService,
    private readonly planningService: PlanningService,
    private readonly transactionsService: TransactionsService,
    private readonly transactionsRepository: TransactionsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(userId: string, query: DashboardQuery): Promise<DashboardResponse> {
    const now = this.clock.now();
    const current = monthYearOf(now);
    const ref: MonthRef =
      query.year !== undefined && query.month !== undefined
        ? { year: query.year, month: query.month }
        : current;
    const isCurrent = ref.year === current.year && ref.month === current.month;

    if (isCurrent) {
      await this.planningService.ensure(userId, ref); // virada lazy (§6.2)
    }
    await this.transactionsService.autoConfirmDue(userId); // §6.3 lazy

    const progress = this.progressFor(ref, now, isCurrent);
    const lenses = await this.budgetService.computeLenses(userId, ref);
    const pacing = this.pacingService.compute({
      projectedCents: lenses.projectedCents,
      monthTransactions: lenses.monthTransactions,
      daysInMonth: progress.daysInMonth,
      elapsedDays: progress.elapsedDays,
    });
    const projection = this.projectionService.compute({
      currentCents: lenses.currentCents,
      monthTransactions: lenses.monthTransactions,
      elapsedDays: progress.elapsedDays,
      remainingDays: progress.remainingDays,
    });
    const topCategories = await this.categoryStatisticsService.compute(
      userId,
      lenses.monthTransactions,
    );
    const recent = await this.transactionsRepository.listPage(userId, { limit: 5 });

    // Gasto Diário Recomendado (FR-004): max(0, Projetado) / diasRestantes
    const dailyBudgetCents = Math.floor(
      Math.max(0, lenses.projectedCents) / progress.remainingDays,
    );

    return dashboardResponseSchema.parse({
      year: ref.year,
      month: ref.month,
      projectedBalanceCents: lenses.projectedCents,
      currentBalanceCents: lenses.currentCents,
      plannedAvailableCents: lenses.plannedCents,
      dailyBudgetCents,
      pacing,
      projection,
      monthProgress: progress,
      recentTransactions: recent.items,
      topCategories,
    });
  }

  /**
   * diasDecorridos/diasRestantes (DOMAIN §5) valem para o mês corrente; para
   * meses encerrados o mês conta como integralmente decorrido (restante = 1),
   * e para meses futuros como dia 1 — mantendo as fórmulas totais.
   */
  private progressFor(
    ref: MonthRef,
    now: Date,
    isCurrent: boolean,
  ): { daysInMonth: number; elapsedDays: number; remainingDays: number } {
    const total = daysInMonth(ref.year, ref.month);
    if (isCurrent) {
      const day = localDateOf(now).day;
      return { daysInMonth: total, elapsedDays: day, remainingDays: total - day + 1 };
    }
    const past =
      ref.year < monthYearOf(now).year ||
      (ref.year === monthYearOf(now).year && ref.month < monthYearOf(now).month);
    return past
      ? { daysInMonth: total, elapsedDays: total, remainingDays: 1 }
      : { daysInMonth: total, elapsedDays: 1, remainingDays: total };
  }
}
