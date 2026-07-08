/** Payload do JWT — schema-first também para o token (ADR-014). */
import { objectIdSchema } from '@finances/shared';
import { z } from 'zod';

export const jwtPayloadSchema = z.object({
  sub: objectIdSchema, // id do usuário
  email: z.email(),
});

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

/** Usuário autenticado anexado à requisição pelo guard. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
}
