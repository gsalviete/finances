/**
 * DraftTransaction — a Inbox da automação (DOMAIN §3.6, DATABASE §2.6).
 * Nenhuma movimentação vira Transaction sem passar por aqui (FR-025–030).
 */
import { z } from 'zod';
import { draftStatusSchema } from '../enums';
import { dateSchema, objectIdSchema } from './common';

export const draftTransactionSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  rawNotification: z
    .string('rawNotification deve ser um texto')
    .min(1, 'rawNotification é obrigatório (payload bruto da notificação)'),
  /**
   * Resultado do parser — intencionalmente aberto na V1: o contrato interno do
   * parser único é definido na Fase 24, sem alterar o contrato da Inbox (ADR-008).
   */
  parsedData: z.record(z.string(), z.unknown()),
  confidence: z
    .number('confidence deve ser um número')
    .min(0, 'confidence deve estar entre 0 e 1')
    .max(1, 'confidence deve estar entre 0 e 1'),
  status: draftStatusSchema,
  clientEventId: z
    .string('clientEventId deve ser um texto')
    .min(1, 'clientEventId é obrigatório (idempotência — ADR-006)'),
  createdAt: dateSchema,
  confirmedAt: dateSchema.nullable(),
});

export type DraftTransaction = z.infer<typeof draftTransactionSchema>;
