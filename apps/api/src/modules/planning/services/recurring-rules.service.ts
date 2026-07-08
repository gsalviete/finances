import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Clock,
  CreateRecurringRuleInput,
  RecurringRule,
  UpdateRecurringRuleInput,
} from '@finances/shared';
import { CLOCK } from '../../../common/clock/clock.module';
import { TransactionsService } from '../../transactions/transactions.service';
import { RecurringRulesRepository } from '../repository/recurring-rules.repository';

@Injectable()
export class RecurringRulesService {
  constructor(
    private readonly repository: RecurringRulesRepository,
    private readonly transactionsService: TransactionsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(userId: string, input: CreateRecurringRuleInput): Promise<RecurringRule> {
    await this.transactionsService.assertUsableCategory(userId, input.categoryId);
    return this.repository.create({ userId, ...input });
  }

  async list(userId: string, onlyActive: boolean): Promise<RecurringRule[]> {
    return this.repository.listForUser(userId, onlyActive);
  }

  async get(userId: string, id: string): Promise<RecurringRule> {
    const rule = await this.repository.findByIdForUser(id, userId);
    if (rule === null) {
      throw new NotFoundException('Recorrência não encontrada');
    }
    return rule;
  }

  /**
   * Editar uma regra NUNCA altera meses passados (DOMAIN §3.5): aqui só muda o
   * template; snapshots existentes permanecem congelados (garantido na Fase 14).
   */
  async update(
    userId: string,
    id: string,
    input: UpdateRecurringRuleInput,
  ): Promise<RecurringRule> {
    const current = await this.get(userId, id);
    const startDate = input.startDate !== undefined ? input.startDate : current.startDate;
    const endDate = input.endDate !== undefined ? input.endDate : current.endDate;
    if (startDate !== null && endDate !== null && endDate < startDate) {
      throw new BadRequestException({
        message: 'endDate não pode ser anterior a startDate',
        issues: [{ path: 'endDate', message: 'endDate não pode ser anterior a startDate' }],
      });
    }
    if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
      await this.transactionsService.assertUsableCategory(userId, input.categoryId);
    }
    const updated = await this.repository.updateForUser(id, userId, input);
    if (updated === null) {
      throw new NotFoundException('Recorrência não encontrada');
    }
    return updated;
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const rule = await this.get(userId, id);
    await this.repository.softDeleteById(rule.id, {
      deletedAt: this.clock.now(),
      deletedBy: userId,
    });
  }
}
