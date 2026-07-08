/** RecurringRule — template persistente de recorrência (DOMAIN §3.5, DATABASE §2.5). */
import { z } from 'zod';
import { recurrenceTypeSchema, transactionTypeSchema } from '../enums';
import {
  dateSchema,
  dayOfMonthSchema,
  objectIdSchema,
  positiveCentsSchema,
  softDeleteShape,
  timestampsShape,
} from './common';

export const recurringRuleSchema = z
  .object({
    id: objectIdSchema,
    userId: objectIdSchema,
    type: transactionTypeSchema,
    investment: z.boolean(), // ADR-017: true exige type=EXPENSE
    description: z
      .string('descrição deve ser um texto')
      .trim()
      .min(1, 'descrição da recorrência é obrigatória'),
    categoryId: objectIdSchema,
    amountCents: positiveCentsSchema,
    recurrenceType: recurrenceTypeSchema, // apenas MONTHLY na V1
    dayOfMonth: dayOfMonthSchema, // ajustado ao último dia em meses curtos (Time.clampDayToMonth)
    startDate: dateSchema.nullable(),
    endDate: dateSchema.nullable(),
    active: z.boolean(),
    ...softDeleteShape,
    ...timestampsShape,
  })
  .refine(
    (rule) => rule.startDate === null || rule.endDate === null || rule.endDate >= rule.startDate,
    { message: 'endDate não pode ser anterior a startDate', path: ['endDate'] },
  )
  .refine((rule) => !rule.investment || rule.type === 'EXPENSE', {
    message: 'regra de investimento exige type=EXPENSE (FR-013 / ADR-017)',
    path: ['investment'],
  });

export type RecurringRule = z.infer<typeof recurringRuleSchema>;

/** Criação de recorrência (Fase 13). `active` nasce true por padrão. */
export const createRecurringRuleInputSchema = z
  .object({
    type: transactionTypeSchema,
    investment: z.boolean().default(false), // ADR-017
    description: z
      .string('descrição deve ser um texto')
      .trim()
      .min(1, 'descrição da recorrência é obrigatória'),
    categoryId: objectIdSchema,
    amountCents: positiveCentsSchema,
    recurrenceType: recurrenceTypeSchema.default('MONTHLY'),
    dayOfMonth: dayOfMonthSchema,
    startDate: dateSchema.nullable().default(null),
    endDate: dateSchema.nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine(
    (rule) => rule.startDate === null || rule.endDate === null || rule.endDate >= rule.startDate,
    { message: 'endDate não pode ser anterior a startDate', path: ['endDate'] },
  )
  .refine((rule) => !rule.investment || rule.type === 'EXPENSE', {
    message: 'regra de investimento exige type=EXPENSE (FR-013 / ADR-017)',
    path: ['investment'],
  });

export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleInputSchema>;

/** Atualização parcial. Janela start/end revalidada no serviço com o estado final. */
export const updateRecurringRuleInputSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    investment: z.boolean().optional(), // coerência type×investment revalidada no serviço
    description: z
      .string('descrição deve ser um texto')
      .trim()
      .min(1, 'descrição da recorrência é obrigatória')
      .optional(),
    categoryId: objectIdSchema.optional(),
    amountCents: positiveCentsSchema.optional(),
    dayOfMonth: dayOfMonthSchema.optional(),
    startDate: dateSchema.nullable().optional(),
    endDate: dateSchema.nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'ao menos um campo deve ser informado');

export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleInputSchema>;
