/**
 * Contratos de autenticação (ARCHITECTURE §3: register/login/me — single user V1).
 * Campos derivados do userSchema (ADR-014): nenhuma redeclaração de forma.
 */
import { z } from 'zod';
import { safeUserSchema, userSchema } from './user';

const passwordSchema = z
  .string('senha deve ser um texto')
  .min(8, 'senha deve ter no mínimo 8 caracteres')
  .max(128, 'senha deve ter no máximo 128 caracteres');

export const registerInputSchema = z.object({
  name: userSchema.shape.name,
  email: userSchema.shape.email,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: userSchema.shape.email,
  password: z.string('senha deve ser um texto').min(1, 'senha é obrigatória'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/** Resposta de register/login: sessão autenticada. Nunca contém passwordHash. */
export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  user: safeUserSchema,
});

export type AuthSession = z.infer<typeof authSessionSchema>;
