/**
 * Category — customizável, nunca fixa, arquivável sem perda (DOMAIN §3.3, DATABASE §2.2).
 * `sortOrder` e `expiresAt` + regra de exclusão em uso: ADR-016.
 */
import { z } from 'zod';
import { dateSchema, objectIdSchema, softDeleteShape, timestampsShape } from './common';

export const categorySchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  name: z
    .string('nome deve ser um texto')
    .trim()
    .min(1, 'nome da categoria é obrigatório')
    .max(60, 'nome da categoria deve ter no máximo 60 caracteres'),
  icon: z.string().trim().min(1, 'ícone é obrigatório (nome de ícone Lucide)'),
  color: z.string().trim().min(1, 'cor é obrigatória (token de cor, nunca hardcoded)'),
  active: z.boolean(),
  archived: z.boolean(),
  sortOrder: z
    .number('sortOrder deve ser um número')
    .int('sortOrder deve ser um inteiro')
    .min(0, 'sortOrder não pode ser negativo'),
  expiresAt: dateSchema.nullable(), // null = permanente (ADR-016)
  ...softDeleteShape,
  ...timestampsShape,
});

export type Category = z.infer<typeof categorySchema>;

/** Criação: demais campos têm default de domínio (active=true, archived=false, fim da fila). */
export const createCategoryInputSchema = categorySchema
  .pick({ name: true, icon: true, color: true })
  .extend({
    sortOrder: categorySchema.shape.sortOrder.optional(),
    expiresAt: categorySchema.shape.expiresAt.optional(),
  });

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

/** Atualização parcial — inclui arquivar/restaurar via `archived` (ARCHITECTURE §3). */
export const updateCategoryInputSchema = categorySchema
  .pick({
    name: true,
    icon: true,
    color: true,
    active: true,
    archived: true,
    sortOrder: true,
    expiresAt: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'ao menos um campo deve ser informado');

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

/** Filtros de listagem: por padrão arquivadas e expiradas ficam de fora (ADR-016). */
export const listCategoriesQuerySchema = z.object({
  includeArchived: z.stringbool().default(false),
  includeExpired: z.stringbool().default(false),
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
