/**
 * User — single user na V1, modelagem pronta para multiusuário (DOMAIN §3.7, DATABASE §2.1).
 * `passwordHash` NUNCA é exportado/serializado para fora (ADR-012): toda resposta
 * de API usa `safeUserSchema`, derivado por omissão — nunca uma interface paralela.
 */
import { z } from 'zod';
import { objectIdSchema, timestampsShape } from './common';

export const userSchema = z.object({
  id: objectIdSchema,
  name: z.string('nome deve ser um texto').trim().min(1, 'nome é obrigatório').max(120),
  email: z.email('email inválido'),
  passwordHash: z.string().min(1, 'passwordHash é obrigatório'), // Argon2
  ...timestampsShape,
});

export type User = z.infer<typeof userSchema>;

/** Forma pública do usuário — jamais contém passwordHash (ADR-012). */
export const safeUserSchema = userSchema.omit({ passwordHash: true });

export type SafeUser = z.infer<typeof safeUserSchema>;
