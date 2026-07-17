/** wishlistItems (ADR-018). Isolada do núcleo financeiro; soft delete como as demais. */
import { Schema } from 'mongoose';
import { softDeletePlugin } from '../plugins/soft-delete.plugin';
import { MODELS } from './collections';

export const wishlistItemMongooseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: MODELS.User, required: true },
    url: { type: String, required: true },
    name: { type: String, required: true },
    priceCents: { type: Number, default: null }, // centavos inteiros; null = sem preço ainda
    currency: { type: String, required: true }, // ISO 4217
    imageUrl: { type: String, default: null },
    priority: { type: String, required: true }, // HIGH | MEDIUM | LOW
    scrapeStatus: { type: String, required: true }, // OK | PARTIAL | FAILED
    scrapedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: MODELS.User, default: null },
  },
  { timestamps: true },
);

// Índice de listagem (ADR-018): casa com o filtro padrão do soft delete.
wishlistItemMongooseSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });

wishlistItemMongooseSchema.plugin(softDeletePlugin);
