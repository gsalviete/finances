/** monthlyPlans — snapshot de intenção com itens EMBUTIDOS (DATABASE §2.4). */
import { PLAN_ITEM_KINDS, PLAN_ITEM_STATUSES } from '@finances/shared';
import { Schema } from 'mongoose';
import { MODELS } from './collections';

const planItemSchema = new Schema({
  kind: { type: String, enum: PLAN_ITEM_KINDS, required: true },
  description: { type: String, required: true },
  amountCents: { type: Number, required: true }, // valor congelado do mês
  categoryId: { type: Schema.Types.ObjectId, ref: MODELS.Category, required: true },
  status: { type: String, enum: PLAN_ITEM_STATUSES, required: true },
  linkedTransactionId: { type: Schema.Types.ObjectId, ref: MODELS.Transaction, default: null },
});

export const monthlyPlanMongooseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: MODELS.User, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    archived: { type: Boolean, required: true }, // encerramento não destrutivo
    notes: { type: String, default: '' },
    monthlyPlanItems: { type: [planItemSchema], default: [] },
  },
  { timestamps: true },
);

// Índices (DATABASE §3) — único: chave da idempotência da virada de mês
monthlyPlanMongooseSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });
