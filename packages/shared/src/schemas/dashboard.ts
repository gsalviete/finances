/**
 * Contrato do Dashboard (FR-001–007; fórmulas em DOMAIN_MODEL §4–5).
 * O frontend NUNCA calcula indicadores: recebe tudo pronto deste DTO.
 */
import { z } from 'zod';
import { pacingStatusSchema } from '../enums';
import { transactionSchema } from './transaction';
import { centsSchema, monthSchema, objectIdSchema, yearSchema } from './common';

export const dashboardResponseSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  /** Saldo Projetado — o número-herói (CONFIRMED + FORECAST). */
  projectedBalanceCents: centsSchema,
  /** Saldo Atual — o caixa honesto (somente CONFIRMED). */
  currentBalanceCents: centsSchema,
  /** Planejado — derivado do snapshot; null quando o mês não tem snapshot. */
  plannedAvailableCents: centsSchema.nullable(),
  /** Gasto Diário Recomendado = max(0, Projetado) / diasRestantes (FR-004). */
  dailyBudgetCents: centsSchema,
  /** Ritmo Financeiro (FR-003) — estimativa linear, nunca certeza. */
  pacing: z.object({
    expectedCents: centsSchema,
    actualCents: centsSchema,
    ratio: z.number().nullable(),
    status: pacingStatusSchema,
  }),
  /** Projeção de Encerramento (FR-005) — heurística linear determinística. */
  projection: z.object({
    endOfMonthCents: centsSchema,
    dailyVariableAverageCents: centsSchema,
    remainingCommitmentsCents: centsSchema,
  }),
  monthProgress: z.object({
    daysInMonth: z.number().int(),
    elapsedDays: z.number().int(),
    remainingDays: z.number().int(),
  }),
  /** Últimas movimentações (FR-006). */
  recentTransactions: z.array(transactionSchema),
  /** Categorias mais utilizadas por gasto confirmado (FR-007). */
  topCategories: z.array(
    z.object({
      categoryId: objectIdSchema,
      name: z.string(),
      totalCents: centsSchema,
      percentage: z.number(),
    }),
  ),
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const dashboardQuerySchema = z
  .object({
    year: z.coerce.number().int().min(1970).max(9999).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((query) => (query.year === undefined) === (query.month === undefined), {
    message: 'year e month devem ser informados juntos (ou nenhum, para o mês corrente)',
    path: ['month'],
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
