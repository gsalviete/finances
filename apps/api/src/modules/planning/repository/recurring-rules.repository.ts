import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { recurringRuleSchema, type RecurringRule } from '@finances/shared';
import type { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database/base.repository';
import { MODELS } from '../../../common/database/schemas/collections';

@Injectable()
export class RecurringRulesRepository extends BaseRepository<RecurringRule> {
  constructor(@InjectModel(MODELS.RecurringRule) model: Model<Record<string, unknown>>) {
    super(model, recurringRuleSchema);
  }

  async listForUser(userId: string, onlyActive: boolean): Promise<RecurringRule[]> {
    const filter: Record<string, unknown> = { userId };
    if (onlyActive) filter.active = true;
    const docs = await this.model.find(filter).sort({ dayOfMonth: 1, description: 1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByIdForUser(id: string, userId: string): Promise<RecurringRule | null> {
    if (!this.isValidObjectId(id)) return null;
    const doc = await this.model.findOne({ _id: id, userId });
    return doc === null ? null : this.toDomain(doc);
  }

  async updateForUser(
    id: string,
    userId: string,
    update: Record<string, unknown>,
  ): Promise<RecurringRule | null> {
    if (!this.isValidObjectId(id)) return null;
    const doc = await this.model.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { returnDocument: 'after', runValidators: true },
    );
    return doc === null ? null : this.toDomain(doc);
  }
}
