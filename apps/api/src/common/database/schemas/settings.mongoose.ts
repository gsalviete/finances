/** settings (DATABASE §2.7). Sem índices no contrato. */
import { BACKUP_FREQUENCIES, MOTION_LEVELS, THEMES } from '@finances/shared';
import { Schema } from 'mongoose';
import { MODELS } from './collections';

export const settingsMongooseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: MODELS.User, required: true },
    theme: { type: String, enum: THEMES, required: true }, // único enum minúsculo
    currency: { type: String, required: true },
    language: { type: String, required: true },
    timezone: { type: String, required: true },
    backupFrequency: { type: String, enum: BACKUP_FREQUENCIES, required: true },
    animationsEnabled: { type: Boolean, required: true },
    motionLevel: { type: String, enum: MOTION_LEVELS, required: true },
  },
  { timestamps: true },
);
