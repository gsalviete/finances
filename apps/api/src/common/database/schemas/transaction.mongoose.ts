/**
 * transactions — agregado central (DATABASE §2.3).
 * `month`/`year` são denormalizados NA ESCRITA a partir de `date` no fuso do
 * domínio (ADR-005), por hooks — nunca confiados ao chamador.
 */
import {
  monthYearOf,
  TRANSACTION_ORIGINS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from '@finances/shared';
import { Schema } from 'mongoose';
import { softDeletePlugin } from '../plugins/soft-delete.plugin';
import { MODELS } from './collections';

export const transactionMongooseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: MODELS.User, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: MODELS.Category, required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    status: { type: String, enum: TRANSACTION_STATUSES, required: true },
    amountCents: { type: Number, required: true },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    month: { type: Number, required: true }, // derivado por hook
    year: { type: Number, required: true }, // derivado por hook
    origin: { type: String, enum: TRANSACTION_ORIGINS, required: true },
    linkedPlanItemId: { type: Schema.Types.ObjectId, default: null },
    installmentGroupId: { type: Schema.Types.ObjectId, default: null },
    installmentNumber: { type: Number, default: null },
    installmentTotal: { type: Number, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: MODELS.User, default: null },
  },
  { timestamps: true },
);

// Índices (DATABASE §3)
transactionMongooseSchema.index({ userId: 1, date: -1 });
transactionMongooseSchema.index({ userId: 1, year: 1, month: 1, status: 1 });
transactionMongooseSchema.index({ userId: 1, categoryId: 1 });
transactionMongooseSchema.index({ userId: 1, type: 1, status: 1 });
transactionMongooseSchema.index({ userId: 1, installmentGroupId: 1 });
transactionMongooseSchema.index({ userId: 1, origin: 1 });

transactionMongooseSchema.plugin(softDeletePlugin);

// Denormalização month/year na escrita (roda antes da validação de required)
transactionMongooseSchema.pre('validate', function () {
  if (this.date instanceof Date) {
    const { month, year } = monthYearOf(this.date);
    this.month = month;
    this.year = year;
  }
});

// Mantém a coerência quando `date` muda via findOneAndUpdate (DATABASE §5)
transactionMongooseSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  if (update === null || Array.isArray(update)) return;
  const set = (update.$set ?? update) as Record<string, unknown>;
  const date = set.date instanceof Date ? set.date : undefined;
  if (date) {
    const { month, year } = monthYearOf(date);
    this.set({ month, year });
  }
});
