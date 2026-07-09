/** Env da API — validado por Zod na subida (schema-first, ADR-014). */
import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI é obrigatório'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter no mínimo 32 caracteres'),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN deve ser número + unidade (ex.: 7d, 12h)')
      .default('7d'),
    // --- Hardening (Fase 25) ---
    CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    // --- Backup (Fase 18): dev = LOCAL, prod = OBJECT_STORAGE (ARCHITECTURE §5) ---
    BACKUP_PROVIDER: z.enum(['LOCAL', 'OBJECT_STORAGE']).default('LOCAL'),
    BACKUP_LOCAL_DIR: z.string().min(1).default('./backups'),
    OBJECT_STORAGE_ENDPOINT: z.string().optional(),
    OBJECT_STORAGE_REGION: z.string().optional(),
    OBJECT_STORAGE_BUCKET: z.string().optional(),
    OBJECT_STORAGE_ACCESS_KEY: z.string().optional(),
    OBJECT_STORAGE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.BACKUP_PROVIDER === 'OBJECT_STORAGE') {
      for (const key of [
        'OBJECT_STORAGE_ENDPOINT',
        'OBJECT_STORAGE_REGION',
        'OBJECT_STORAGE_BUCKET',
        'OBJECT_STORAGE_ACCESS_KEY',
        'OBJECT_STORAGE_SECRET_KEY',
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            message: `${key} é obrigatório com BACKUP_PROVIDER=OBJECT_STORAGE`,
            path: [key],
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
