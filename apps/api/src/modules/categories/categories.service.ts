import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Category,
  Clock,
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from '@finances/shared';
import { CLOCK } from '../../common/clock/clock.module';
import { CategoriesRepository } from './repository/categories.repository';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly repository: CategoriesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const sortOrder = input.sortOrder ?? (await this.repository.nextSortOrder(userId));
    return this.repository.create({
      userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      active: true,
      archived: false,
      sortOrder,
      expiresAt: input.expiresAt ?? null,
    });
  }

  async list(userId: string, query: ListCategoriesQuery): Promise<Category[]> {
    return this.repository.listForUser(userId, {
      includeArchived: query.includeArchived,
      includeExpired: query.includeExpired,
      now: this.clock.now(),
    });
  }

  async get(userId: string, id: string): Promise<Category> {
    const category = await this.repository.findByIdForUser(id, userId);
    if (category === null) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return category;
  }

  async update(userId: string, id: string, input: UpdateCategoryInput): Promise<Category> {
    const updated = await this.repository.updateForUser(id, userId, input);
    if (updated === null) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return updated;
  }

  /** Soft delete (ADR-010); bloqueado quando em uso por transações (ADR-016). */
  async softDelete(userId: string, id: string): Promise<void> {
    const category = await this.get(userId, id);
    const usage = await this.repository.countTransactionsUsing(userId, category.id);
    if (usage > 0) {
      throw new ConflictException({
        message: `Categoria em uso por ${usage} transação(ões); arquive-a em vez de excluir`,
        reason: 'CATEGORY_IN_USE',
      });
    }
    await this.repository.softDeleteById(category.id, {
      deletedAt: this.clock.now(),
      deletedBy: userId,
    });
  }
}
