/** Category — customizável, nunca fixa, arquivável sem perda (DOMAIN §3.3, DATABASE §2.2). */
import { z } from 'zod';
import { objectIdSchema, softDeleteShape, timestampsShape } from './common';

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
  ...softDeleteShape,
  ...timestampsShape,
});

export type Category = z.infer<typeof categorySchema>;
