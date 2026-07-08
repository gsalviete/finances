import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { categorySchema, type Category } from '@finances/shared';
import type { Model, QueryFilter } from 'mongoose';
import { BaseRepository } from '../../../common/database/base.repository';
import { MODELS } from '../../../common/database/schemas/collections';

export interface ListCategoriesFilter {
  includeArchived: boolean;
  includeExpired: boolean;
  now: Date;
}

@Injectable()
export class CategoriesRepository extends BaseRepository<Category> {
  constructor(
    @InjectModel(MODELS.Category) model: Model<Record<string, unknown>>,
    @InjectModel(MODELS.Transaction)
    private readonly transactionModel: Model<Record<string, unknown>>,
  ) {
    super(model, categorySchema);
  }

  /** Listagem escopada: padrão exclui arquivadas e expiradas (ADR-016). */
  async listForUser(userId: string, filter: ListCategoriesFilter): Promise<Category[]> {
    const query: QueryFilter<Record<string, unknown>> = { userId };
    if (!filter.includeArchived) query.archived = false;
    if (!filter.includeExpired) {
      query.$or = [{ expiresAt: null }, { expiresAt: { $gt: filter.now } }];
    }
    const docs = await this.model.find(query).sort({ sortOrder: 1, name: 1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByIdForUser(id: string, userId: string): Promise<Category | null> {
    if (!this.isValidObjectId(id)) return null;
    const doc = await this.model.findOne({ _id: id, userId });
    return doc === null ? null : this.toDomain(doc);
  }

  async updateForUser(
    id: string,
    userId: string,
    update: Record<string, unknown>,
  ): Promise<Category | null> {
    if (!this.isValidObjectId(id)) return null;
    const doc = await this.model.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { returnDocument: 'after', runValidators: true },
    );
    return doc === null ? null : this.toDomain(doc);
  }

  /** Próxima posição da fila do usuário (criação sem sortOrder explícito — ADR-016). */
  async nextSortOrder(userId: string): Promise<number> {
    const last = await this.model.findOne({ userId }).sort({ sortOrder: -1 });
    const current = last?.get('sortOrder') as number | undefined;
    return current === undefined ? 0 : current + 1;
  }

  /** Uso por transações não-deletadas (o plugin de soft delete filtra as deletadas). */
  async countTransactionsUsing(userId: string, categoryId: string): Promise<number> {
    return this.transactionModel.countDocuments({ userId, categoryId });
  }
}
