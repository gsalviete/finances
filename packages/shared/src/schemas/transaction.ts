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

/**
 * Criação manual (FR-014): tipo, categoria, valor, data, descrição.
 * `origin`, `month`/`year` e defaults são responsabilidade do servidor.
 * Nasce FORECAST ou CONFIRMED (DOMAIN §3.2) — nunca CANCELLED.
 */
export const createTransactionInputSchema = z.object({
  type: transactionTypeSchema,
  status: transactionStatusSchema.exclude(['CANCELLED']).default('CONFIRMED'),
  amountCents: positiveCentsSchema,
  description: z.string('descrição deve ser um texto').trim().max(500),
  date: dateSchema,
  categoryId: objectIdSchema,
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

/**
 * Atualização parcial; confirmação (FORECAST→CONFIRMED) e cancelamento
 * (→CANCELLED) via PATCH (ARCHITECTURE §3). Transições validadas no serviço.
 */
export const updateTransactionInputSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    status: transactionStatusSchema.optional(),
    amountCents: positiveCentsSchema.optional(),
    description: z.string('descrição deve ser um texto').trim().max(500).optional(),
    date: dateSchema.optional(),
    categoryId: objectIdSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'ao menos um campo deve ser informado');

export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;

/** Compra parcelada (DOMAIN §6.1): materializa N transações EXPENSE na criação. */
export const createInstallmentPurchaseInputSchema = z
  .object({
    totalAmountCents: positiveCentsSchema,
    installmentTotal: z
      .number('installmentTotal deve ser um número')
      .int('installmentTotal deve ser um inteiro')
      .min(2, 'parcelamento exige ao menos 2 parcelas')
      .max(120, 'parcelamento suporta no máximo 120 parcelas'),
    description: z.string('descrição deve ser um texto').trim().max(500),
    date: dateSchema, // data da compra = data da 1ª parcela
    categoryId: objectIdSchema,
  })
  .refine((input) => input.totalAmountCents >= input.installmentTotal, {
    message: 'cada parcela deve valer ao menos 1 centavo (amountCents > 0 — DOMAIN §3.1)',
    path: ['installmentTotal'],
  });

export type CreateInstallmentPurchaseInput = z.infer<typeof createInstallmentPurchaseInputSchema>;

/** Listagem com paginação por cursor (Fase 11); ordenação estável date desc, id desc. */
export const listTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
  year: z.coerce.number().int().min(1970).max(9999).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
  categoryId: objectIdSchema.optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export const transactionListPageSchema = z.object({
  items: z.array(transactionSchema),
  nextCursor: z.string().nullable(),
});

export type TransactionListPage = z.infer<typeof transactionListPageSchema>;
