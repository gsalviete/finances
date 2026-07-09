/** draftTransactions — a Inbox (DATABASE §2.6). Sem updatedAt no contrato. */
import { DRAFT_STATUSES } from '@finances/shared';
import { Schema } from 'mongoose';
import { MODELS } from './collections';

export const draftTransactionMongooseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: MODELS.User, required: true },
    rawNotification: { type: String, required: true },
    parsedData: { type: Schema.Types.Mixed, required: true },
    confidence: { type: Number, required: true },
    status: { type: String, enum: DRAFT_STATUSES, required: true },
    clientEventId: { type: String, required: true }, // idempotência (ADR-006)
    confirmedAt: { type: Date, default: null },
  },
  // minimize:false — parsedData:{} é estado legítimo (parser não identificou nada)
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

// Índices (DATABASE §3)
draftTransactionMongooseSchema.index({ userId: 1, status: 1, createdAt: -1 });
draftTransactionMongooseSchema.index({ userId: 1, clientEventId: 1 }, { unique: true });
