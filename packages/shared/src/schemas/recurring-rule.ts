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
  );

export type RecurringRule = z.infer<typeof recurringRuleSchema>;
