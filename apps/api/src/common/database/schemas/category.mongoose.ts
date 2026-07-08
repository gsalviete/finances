/** categories (DATABASE §2.2). Nunca removida fisicamente — soft delete + arquivamento. */
import { Schema } from 'mongoose';
import { softDeletePlugin } from '../plugins/soft-delete.plugin';
import { MODELS } from './collections';

export const categoryMongooseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: MODELS.User, required: true },
    name: { type: String, required: true },
    icon: { type: String, required: true }, // nome do ícone Lucide
    color: { type: String, required: true }, // token de cor, nunca hardcoded
    active: { type: Boolean, required: true },
    archived: { type: Boolean, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: MODELS.User, default: null },
  },
  { timestamps: true },
);

// Índices (DATABASE §3)
categoryMongooseSchema.index({ userId: 1, archived: 1 });

categoryMongooseSchema.plugin(softDeletePlugin);
