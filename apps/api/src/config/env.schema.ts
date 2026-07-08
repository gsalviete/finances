/** Env da API — validado por Zod na subida (schema-first, ADR-014). */
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI é obrigatório'),
});

export type Env = z.infer<typeof envSchema>;
