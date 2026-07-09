/**
 * Enums de domínio — fonte única (ADR-014, DATABASE §2).
 * Convenção: MAIÚSCULOS; única exceção é `theme` (minúsculo, casa com next-themes).
 * Nunca usar o keyword `enum` do TS: os valores vivem uma vez, como arrays `as const`,
 * e os schemas Zod (z.enum) + tipos derivam deles.
 */
import { z } from 'zod';

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const TRANSACTION_STATUSES = ['FORECAST', 'CONFIRMED', 'CANCELLED'] as const;
export const transactionStatusSchema = z.enum(TRANSACTION_STATUSES);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const TRANSACTION_ORIGINS = ['MANUAL', 'AUTOMATION', 'IMPORT'] as const;
export const transactionOriginSchema = z.enum(TRANSACTION_ORIGINS);
export type TransactionOrigin = z.infer<typeof transactionOriginSchema>;

export const PLAN_ITEM_KINDS = ['INCOME', 'EXPENSE', 'INVESTMENT'] as const;
export const planItemKindSchema = z.enum(PLAN_ITEM_KINDS);
export type PlanItemKind = z.infer<typeof planItemKindSchema>;

export const PLAN_ITEM_STATUSES = ['PENDING', 'PAID'] as const;
export const planItemStatusSchema = z.enum(PLAN_ITEM_STATUSES);
export type PlanItemStatus = z.infer<typeof planItemStatusSchema>;

export const RECURRENCE_TYPES = ['MONTHLY'] as const; // apenas MONTHLY na V1 (DOMAIN §3.5)
export const recurrenceTypeSchema = z.enum(RECURRENCE_TYPES);
export type RecurrenceType = z.infer<typeof recurrenceTypeSchema>;

export const DRAFT_STATUSES = ['PENDING', 'CONFIRMED', 'IGNORED'] as const;
export const draftStatusSchema = z.enum(DRAFT_STATUSES);
export type DraftStatus = z.infer<typeof draftStatusSchema>;

export const BACKUP_PROVIDER_TYPES = ['LOCAL', 'OBJECT_STORAGE'] as const;
export const backupProviderTypeSchema = z.enum(BACKUP_PROVIDER_TYPES);
export type BackupProviderType = z.infer<typeof backupProviderTypeSchema>;

export const BACKUP_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export const backupFrequencySchema = z.enum(BACKUP_FREQUENCIES);
export type BackupFrequency = z.infer<typeof backupFrequencySchema>;

export const MOTION_LEVELS = ['FULL', 'REDUCED', 'NONE'] as const;
export const motionLevelSchema = z.enum(MOTION_LEVELS);
export type MotionLevel = z.infer<typeof motionLevelSchema>;

/** Ritmo Financeiro (FR-003): Confortável / Dentro do esperado / Atenção / Crítico. */
export const PACING_STATUSES = ['COMFORTABLE', 'ON_TRACK', 'ATTENTION', 'CRITICAL'] as const;
export const pacingStatusSchema = z.enum(PACING_STATUSES);
export type PacingStatus = z.infer<typeof pacingStatusSchema>;

/** Exceção intencional em minúsculas (DATABASE §2.7): casa com next-themes no frontend. */
export const THEMES = ['light', 'dark', 'system'] as const;
export const themeSchema = z.enum(THEMES);
export type Theme = z.infer<typeof themeSchema>;
