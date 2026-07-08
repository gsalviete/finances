/** Backup — apenas METADADOS; artefatos vivem no destino do BackupProvider (DATABASE §2.8). */
import { z } from 'zod';
import { backupProviderTypeSchema } from '../enums';
import { dateSchema, objectIdSchema } from './common';

export const backupMetadataSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  location: z.string('location deve ser um texto').min(1, 'location é obrigatório'),
  providerType: backupProviderTypeSchema,
  sizeBytes: z
    .number('sizeBytes deve ser um número')
    .int('sizeBytes deve ser um inteiro')
    .min(0, 'sizeBytes não pode ser negativo'),
  checksum: z.string('checksum deve ser um texto').min(1, 'checksum é obrigatório'),
  createdAt: dateSchema,
});

export type BackupMetadata = z.infer<typeof backupMetadataSchema>;
