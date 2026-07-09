/**
 * MonthlyPlan — snapshot de intenção; NUNCA entra no saldo (DOMAIN §3.4, DATABASE §2.4).
 * `monthlyPlanItems` é array embutido. Escalares derivados (expectedIncome etc.)
 * foram removidos do contrato — sempre derivados dos itens, nunca armazenados.
 */
import { z } from 'zod';
import { planItemKindSchema, planItemStatusSchema } from '../enums';
import {
  monthSchema,
  objectIdSchema,
  positiveCentsSchema,
  timestampsShape,
  yearSchema,
} from './common';

export const monthlyPlanItemSchema = z.object({
  id: objectIdSchema,
  kind: planItemKindSchema,
  description: z
    .string('descrição deve ser um texto')
    .trim()
    .min(1, 'descrição do item de plano é obrigatória'),
  amountCents: positiveCentsSchema, // valor congelado para o mês
  categoryId: objectIdSchema,
  status: planItemStatusSchema,
  linkedTransactionId: objectIdSchema.nullable(),
});

export type MonthlyPlanItem = z.infer<typeof monthlyPlanItemSchema>;

export const monthlyPlanSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  month: monthSchema,
  year: yearSchema,
  archived: z.boolean(), // encerramento não destrutivo (DOMAIN §6.2)
  notes: z.string().trim().max(2000),
  monthlyPlanItems: z.array(monthlyPlanItemSchema),
  ...timestampsShape,
});

export type MonthlyPlan = z.infer<typeof monthlyPlanSchema>;

/**
 * Item na edição do plano (PUT /planning): com `id` = item existente; sem `id` = novo.
 * `status` e `linkedTransactionId` são SEMPRE gerenciados pelo sistema.
 */
export const monthlyPlanItemInputSchema = monthlyPlanItemSchema
  .pick({ kind: true, description: true, amountCents: true, categoryId: true })
  .extend({ id: objectIdSchema.optional() });

export type MonthlyPlanItemInput = z.infer<typeof monthlyPlanItemInputSchema>;

/** PUT /planning — edita itens/notas do snapshot do mês (FR-008). */
export const updateMonthlyPlanInputSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  notes: z.string().trim().max(2000).optional(),
  monthlyPlanItems: z.array(monthlyPlanItemInputSchema),
});

export type UpdateMonthlyPlanInput = z.infer<typeof updateMonthlyPlanInputSchema>;

/** POST /planning — gatilho manual da criação do snapshot (equivalente ao lazy). */
export const ensureMonthlyPlanInputSchema = z.object({
  year: yearSchema,
  month: monthSchema,
});

export type EnsureMonthlyPlanInput = z.infer<typeof ensureMonthlyPlanInputSchema>;

/** GET /planning — ambos ausentes = mês corrente. */
export const getMonthlyPlanQuerySchema = z
  .object({
    year: z.coerce.number().int().min(1970).max(9999).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((query) => (query.year === undefined) === (query.month === undefined), {
    message: 'year e month devem ser informados juntos (ou nenhum, para o mês corrente)',
    path: ['month'],
  });

export type GetMonthlyPlanQuery = z.infer<typeof getMonthlyPlanQuerySchema>;
