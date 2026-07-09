import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  monthlyPlanSchema,
  type MonthlyPlan,
  type MonthRef,
  type PlanItemStatus,
} from '@finances/shared';
import type { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database/base.repository';
import { MODELS } from '../../../common/database/schemas/collections';

export interface PlanItemDraft {
  id?: string;
  kind: string;
  description: string;
  amountCents: number;
  categoryId: string;
  status: PlanItemStatus;
  linkedTransactionId: string | null;
}

@Injectable()
export class MonthlyPlansRepository extends BaseRepository<MonthlyPlan> {
  constructor(@InjectModel(MODELS.MonthlyPlan) model: Model<Record<string, unknown>>) {
    super(model, monthlyPlanSchema);
  }

  async findByMonth(userId: string, ref: MonthRef): Promise<MonthlyPlan | null> {
    const doc = await this.model.findOne({ userId, year: ref.year, month: ref.month });
    return doc === null ? null : this.toDomain(doc);
  }

  /** Encerramento NÃO destrutivo (DOMAIN §6.2): arquiva meses anteriores a `ref`. */
  async archiveBefore(userId: string, ref: MonthRef): Promise<void> {
    await this.model.updateMany(
      {
        userId,
        archived: false,
        $or: [{ year: { $lt: ref.year } }, { year: ref.year, month: { $lt: ref.month } }],
      },
      { $set: { archived: true } },
    );
  }

  /** Liga um plan item à sua Transaction (vínculo bidirecional — DATABASE §4). */
  async setItemLink(planId: string, itemId: string, transactionId: string): Promise<void> {
    await this.model.updateOne(
      { _id: planId, 'monthlyPlanItems._id': itemId },
      { $set: { 'monthlyPlanItems.$.linkedTransactionId': transactionId } },
    );
  }

  async setItemStatus(planId: string, itemId: string, status: PlanItemStatus): Promise<void> {
    await this.model.updateOne(
      { _id: planId, 'monthlyPlanItems._id': itemId },
      { $set: { 'monthlyPlanItems.$.status': status } },
    );
  }

  /** Substitui o array embutido (itens com `id` preservam o _id do subdocumento). */
  async replaceItems(
    planId: string,
    items: PlanItemDraft[],
    notes?: string,
  ): Promise<MonthlyPlan | null> {
    const embedded = items.map((item) => ({
      ...(item.id ? { _id: item.id } : {}),
      kind: item.kind,
      description: item.description,
      amountCents: item.amountCents,
      categoryId: item.categoryId,
      status: item.status,
      linkedTransactionId: item.linkedTransactionId,
    }));
    const update: Record<string, unknown> = { monthlyPlanItems: embedded };
    if (notes !== undefined) update.notes = notes;
    const doc = await this.model.findOneAndUpdate(
      { _id: planId },
      { $set: update },
      { returnDocument: 'after', runValidators: true },
    );
    return doc === null ? null : this.toDomain(doc);
  }
}
