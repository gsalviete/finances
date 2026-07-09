/** recurringRules — templates de recorrência (DATABASE §2.5). */
import { RECURRENCE_TYPES, TRANSACTION_TYPES } from '@finances/shared';
import { Schema } from 'mongoose';
import { softDeletePlugin } from '../plugins/soft-delete.plugin';
import { MODELS } from './collections';

export const recurringRuleMongooseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: MODELS.User, required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    investment: { type: Boolean, default: false }, // ADR-017: true exige type=EXPENSE
    description: { type: String, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: MODELS.Category, required: true },
    amountCents: { type: Number, required: true },
    recurrenceType: { type: String, enum: RECURRENCE_TYPES, required: true }, // MONTHLY na V1
    dayOfMonth: { type: Number, required: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    active: { type: Boolean, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: MODELS.User, default: null },
  },
  { timestamps: true },
);

// Índices (DATABASE §3)
recurringRuleMongooseSchema.index({ userId: 1, active: 1, dayOfMonth: 1 });

recurringRuleMongooseSchema.plugin(softDeletePlugin);
