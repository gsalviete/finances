/**
 * Primitivas compartilhadas dos schemas (ADR-014).
 * Toda regra repetida vive aqui uma única vez — mensagens de erro consistentes
 * por construção: o mesmo conceito valida (e erra) sempre do mesmo jeito.
 */
import { z } from 'zod';

/** Id no contrato é sempre string hexadecimal de 24 chars (ObjectId serializado). */
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'id deve ser um ObjectId (24 caracteres hexadecimais)');

/** Centavos: inteiro seguro (ADR-004). Agregações podem ser negativas. */
export const centsSchema = z
  .number('centavos devem ser um número')
  .int('centavos devem ser um inteiro')
  .refine(Number.isSafeInteger, 'centavos fora da faixa segura de inteiros');

/** Magnitude monetária de entidade: sempre > 0 (DOMAIN §3.1, invariante 2). */
export const positiveCentsSchema = centsSchema.refine(
  (cents) => cents > 0,
  'amountCents deve ser maior que zero',
);

export const monthSchema = z
  .number('mês deve ser um número')
  .int('mês deve ser um inteiro')
  .min(1, 'mês deve estar entre 1 e 12')
  .max(12, 'mês deve estar entre 1 e 12');

export const yearSchema = z
  .number('ano deve ser um número')
  .int('ano deve ser um inteiro')
  .min(1970, 'ano deve estar entre 1970 e 9999')
  .max(9999, 'ano deve estar entre 1970 e 9999');

export const dayOfMonthSchema = z
  .number('dia deve ser um número')
  .int('dia deve ser um inteiro')
  .min(1, 'dia deve estar entre 1 e 31')
  .max(31, 'dia deve estar entre 1 e 31');

/** Datas no contrato: aceita Date ou ISO-8601; normaliza para Date (UTC). */
export const dateSchema = z.coerce.date('data inválida');

/** Timezone IANA validada de fato (via Intl), não por regex. */
export const timeZoneSchema = z.string().refine((zone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}, 'timezone deve ser um identificador IANA válido');

/** Campos de auditoria presentes em todas as coleções (DATABASE §1). */
export const timestampsShape = {
  createdAt: dateSchema,
  updatedAt: dateSchema,
} as const;

/** Soft delete (ADR-010): presente nas entidades principais. */
export const softDeleteShape = {
  deletedAt: dateSchema.nullable(),
  deletedBy: objectIdSchema.nullable(),
} as const;
