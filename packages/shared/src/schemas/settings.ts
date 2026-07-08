/** Settings — preferências do usuário (DOMAIN §3.7, DATABASE §2.7). */
import { z } from 'zod';
import { backupFrequencySchema, motionLevelSchema, themeSchema } from '../enums';
import { objectIdSchema, timeZoneSchema, timestampsShape } from './common';

export const settingsSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  theme: themeSchema,
  currency: z
    .string('moeda deve ser um texto')
    .regex(/^[A-Z]{3}$/, 'moeda deve ser um código ISO 4217 (ex.: BRL)'),
  language: z
    .string('idioma deve ser um texto')
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'idioma deve ser um código BCP 47 simples (ex.: pt-BR)'),
  timezone: timeZoneSchema,
  backupFrequency: backupFrequencySchema,
  animationsEnabled: z.boolean(),
  motionLevel: motionLevelSchema,
  ...timestampsShape,
});

export type Settings = z.infer<typeof settingsSchema>;
