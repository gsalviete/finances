/** users (DATABASE §2.1). Sem soft delete no contrato. */
import { Schema } from 'mongoose';

export const userMongooseSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    passwordHash: { type: String, required: true }, // Argon2; nunca exportado (ADR-012)
  },
  { timestamps: true },
);

// Índices (DATABASE §3)
userMongooseSchema.index({ email: 1 }, { unique: true });
