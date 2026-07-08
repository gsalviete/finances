import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { transactionSchema, type Transaction } from '@finances/shared';
import { Types, type Model, type QueryFilter } from 'mongoose';
import { BaseRepository } from '../../../common/database/base.repository';
import { MODELS } from '../../../common/database/schemas/collections';

export interface TransactionListFilter {
  limit: number;
  year?: number;
  month?: number;
  type?: string;
  status?: string;
  categoryId?: string;
  cursor?: { date: Date; id: string };
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: { date: Date; id: string } | null;
}

@Injectable()
export class TransactionsRepository extends BaseRepository<Transaction> {
  constructor(@InjectModel(MODELS.Transaction) model: Model<Record<string, unknown>>) {
    super(model, transactionSchema);
  }

  /** Id gerado na fronteira de persistência (installmentGroupId — Fase 12). */
  newId(): string {
    return new Types.ObjectId().toString();
  }

  async createMany(docs: Record<string, unknown>[]): Promise<Transaction[]> {
    const created = await this.model.insertMany(docs);
    return created.map((doc) => this.toDomain(doc));
  }

  async findByIdForUser(id: string, userId: string): Promise<Transaction | null> {
    if (!this.isValidObjectId(id)) return null;
    const doc = await this.model.findOne({ _id: id, userId });
    return doc === null ? null : this.toDomain(doc);
  }

  async updateForUser(
    id: string,
    userId: string,
    update: Record<string, unknown>,
  ): Promise<Transaction | null> {
    if (!this.isValidObjectId(id)) return null;
    const doc = await this.model.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { returnDocument: 'after', runValidators: true },
    );
    return doc === null ? null : this.toDomain(doc);
  }

  /**
   * Paginação por cursor com ordenação estável (date desc, _id desc) —
   * usa o índice {userId, date:-1} do DATABASE §3.
   */
  async listPage(userId: string, filter: TransactionListFilter): Promise<TransactionPage> {
    const query: QueryFilter<Record<string, unknown>> = { userId };
    if (filter.year !== undefined) query.year = filter.year;
    if (filter.month !== undefined) query.month = filter.month;
    if (filter.type !== undefined) query.type = filter.type;
    if (filter.status !== undefined) query.status = filter.status;
    if (filter.categoryId !== undefined) query.categoryId = filter.categoryId;
    if (filter.cursor) {
      query.$or = [
        { date: { $lt: filter.cursor.date } },
        { date: filter.cursor.date, _id: { $lt: new Types.ObjectId(filter.cursor.id) } },
      ];
    }
    const docs = await this.model
      .find(query)
      .sort({ date: -1, _id: -1 })
      .limit(filter.limit + 1);

    const hasMore = docs.length > filter.limit;
    const pageDocs = hasMore ? docs.slice(0, filter.limit) : docs;
    const items = pageDocs.map((doc) => this.toDomain(doc));
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? { date: last.date, id: last.id } : null,
    };
  }
}
