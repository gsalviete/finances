/** backups — apenas metadados; artefatos vivem no BackupProvider (DATABASE §2.8). */
import { BACKUP_PROVIDER_TYPES } from '@finances/shared';
import { Schema } from 'mongoose';
import { MODELS } from './collections';

export const backupMongooseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: MODELS.User, required: true },
    location: { type: String, required: true },
    providerType: { type: String, enum: BACKUP_PROVIDER_TYPES, required: true },
    sizeBytes: { type: Number, required: true },
    checksum: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
