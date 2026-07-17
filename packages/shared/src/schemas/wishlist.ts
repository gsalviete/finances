/**
 * WishlistItem (ADR-018) — desejo cadastrado por URL; nome/preço/imagem vêm de
 * extração de metadados (snapshot) ou de edição manual. Isolado do núcleo
 * financeiro: nunca entra em saldo, plano ou dashboard.
 */
import { z } from 'zod';
import { wishlistPrioritySchema, wishlistScrapeStatusSchema } from '../enums';
import {
  dateSchema,
  objectIdSchema,
  positiveCentsSchema,
  softDeleteShape,
  timestampsShape,
} from './common';

/** URL http(s) válida — única forma aceita de apontar para produto/imagem. */
export const httpUrlSchema = z
  .string('url deve ser um texto')
  .trim()
  .max(2048, 'url deve ter no máximo 2048 caracteres')
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'url deve ser uma URL http(s) válida');

/** Moeda ISO 4217 (mesma convenção de settings.currency). */
export const currencyCodeSchema = z
  .string('moeda deve ser um texto')
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'moeda deve ser um código ISO 4217 de 3 letras');

export const wishlistItemSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
  url: httpUrlSchema,
  name: z
    .string('nome deve ser um texto')
    .trim()
    .min(1, 'nome do item é obrigatório')
    .max(200, 'nome do item deve ter no máximo 200 caracteres'),
  priceCents: positiveCentsSchema.nullable(), // null = extração falhou e ainda não foi informado
  currency: currencyCodeSchema,
  imageUrl: httpUrlSchema.nullable(),
  priority: wishlistPrioritySchema,
  scrapeStatus: wishlistScrapeStatusSchema,
  scrapedAt: dateSchema.nullable(), // null = nunca extraído com sucesso
  ...softDeleteShape,
  ...timestampsShape,
});

export type WishlistItem = z.infer<typeof wishlistItemSchema>;

/** Criação: só a URL é obrigatória — nome/preço/imagem vêm da extração (ADR-018). */
export const createWishlistItemInputSchema = z.object({
  url: httpUrlSchema,
  priority: wishlistPrioritySchema.default('MEDIUM'),
});

export type CreateWishlistItemInput = z.infer<typeof createWishlistItemInputSchema>;

/** Edição manual: o usuário corrige o que a extração não trouxe (nunca bloqueante). */
export const updateWishlistItemInputSchema = wishlistItemSchema
  .pick({
    url: true,
    name: true,
    priceCents: true,
    currency: true,
    imageUrl: true,
    priority: true,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'ao menos um campo deve ser informado');

export type UpdateWishlistItemInput = z.infer<typeof updateWishlistItemInputSchema>;
