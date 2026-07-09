/**
 * Contratos da automação (FR-025–030, ADR-006/007/008).
 * Nenhuma movimentação entra em `transactions` sem passar pela Inbox.
 */
import { z } from 'zod';
import { dateSchema, objectIdSchema, positiveCentsSchema } from './common';

/** POST /automation/notification — idempotente por clientEventId (ADR-006). */
export const ingestNotificationInputSchema = z.object({
  rawNotification: z
    .string('rawNotification deve ser um texto')
    .trim()
    .min(1, 'rawNotification é obrigatório')
    .max(2000),
  clientEventId: z
    .string('clientEventId deve ser um texto')
    .trim()
    .min(1, 'clientEventId é obrigatório (idempotência — ADR-006)')
    .max(200),
});

export type IngestNotificationInput = z.infer<typeof ingestNotificationInputSchema>;

/** Saída do parser — nunca inventa valores: campos ausentes ficam ausentes. */
export const parsedNotificationSchema = z.object({
  amountCents: positiveCentsSchema.optional(),
  description: z.string().optional(),
});

export type ParsedNotification = z.infer<typeof parsedNotificationSchema>;

/** POST /inbox/:id/confirm — o usuário completa/ajusta o que o parser sugeriu. */
export const confirmDraftInputSchema = z.object({
  categoryId: objectIdSchema, // FR-015: sem categoria não entra
  amountCents: positiveCentsSchema.optional(), // default: o valor parseado
  description: z.string().trim().max(500).optional(),
  date: dateSchema.optional(), // default: createdAt do draft
});

export type ConfirmDraftInput = z.infer<typeof confirmDraftInputSchema>;

/** PUT /inbox/:id — edição da sugestão antes de confirmar. */
export const updateDraftInputSchema = z
  .object({
    amountCents: positiveCentsSchema.optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'ao menos um campo deve ser informado');

export type UpdateDraftInput = z.infer<typeof updateDraftInputSchema>;
