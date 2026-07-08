/** Transaction — agregado raiz e única fonte de verdade financeira (DOMAIN §3.1, DATABASE §2.3). */
import { z } from 'zod';
import { transactionOriginSchema, transactionStatusSchema, transactionTypeSchema } from '../enums';
import {
  dateSchema,
  monthSchema,
  objectIdSchema,
  positiveCentsSchema,
  softDeleteShape,
  timestampsShape,
  yearSchema,
} from './common';

export const transactionSchema = z
  .object({
    id: objectIdSchema,
    userId: objectIdSchema,
    categoryId: objectIdSchema, // obrigatório (FR-015)
    type: transactionTypeSchema,
    status: transactionStatusSchema,
    amountCents: positiveCentsSchema, // magnitude; o sinal vem do type (DOMAIN §2)
    description: z.string('descrição deve ser um texto').trim().max(500),
    date: dateSchema,
    month: monthSchema, // denormalizado no fuso local na escrita (ADR-005)
    year: yearSchema,
    origin: transactionOriginSchema,
    linkedPlanItemId: objectIdSchema.nullable(),
    installmentGroupId: objectIdSchema.nullable(),
    installmentNumber: z.number().int().min(1).nullable(),
    installmentTotal: z.number().int().min(1).nullable(),
    ...softDeleteShape,
    ...timestampsShape,
  })
  .superRefine((transaction, ctx) => {
    const { installmentGroupId, installmentNumber, installmentTotal } = transaction;
    const fields = [installmentGroupId, installmentNumber, installmentTotal];
    const present = fields.filter((field) => field !== null).length;
    if (present !== 0 && present !== fields.length) {
      ctx.addIssue({
        code: 'custom',
        message:
          'campos de parcelamento (installmentGroupId, installmentNumber, installmentTotal) devem vir todos juntos ou nenhum',
        path: ['installmentGroupId'],
      });
      return;
    }
    if (
      installmentNumber !== null &&
      installmentTotal !== null &&
      installmentNumber > installmentTotal
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'installmentNumber não pode ser maior que installmentTotal',
        path: ['installmentNumber'],
      });
    }
  });

export type Transaction = z.infer<typeof transactionSchema>;
