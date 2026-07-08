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
