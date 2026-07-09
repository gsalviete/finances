import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  DOMAIN_TIME_ZONE,
  settingsSchema,
  type Settings,
  type UpdateSettingsInput,
} from '@finances/shared';
import type { Model } from 'mongoose';
import { BaseRepository } from '../../common/database/base.repository';
import { MODELS } from '../../common/database/schemas/collections';

/** Defaults da V1 — aplicados na criação do usuário (roadmap Fase 17). */
export const DEFAULT_SETTINGS = {
  theme: 'system',
  currency: 'BRL',
  language: 'pt-BR',
  timezone: DOMAIN_TIME_ZONE,
  backupFrequency: 'WEEKLY',
  animationsEnabled: true,
  motionLevel: 'FULL',
} as const;

@Injectable()
export class SettingsService extends BaseRepository<Settings> {
  constructor(@InjectModel(MODELS.Settings) model: Model<Record<string, unknown>>) {
    super(model, settingsSchema);
  }

  /** Idempotente: cria com defaults na primeira vez (registro ou primeira leitura). */
  async getOrCreate(userId: string): Promise<Settings> {
    const existing = await this.model.findOne({ userId });
    if (existing !== null) return this.toDomain(existing);
    const doc = await this.model.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, ...DEFAULT_SETTINGS } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    return this.toDomain(doc);
  }

  async update(userId: string, input: UpdateSettingsInput): Promise<Settings> {
    await this.getOrCreate(userId);
    const doc = await this.model.findOneAndUpdate(
      { userId },
      { $set: input },
      { returnDocument: 'after', runValidators: true },
    );
    // getOrCreate garante existência; doc nunca é null aqui
    return this.toDomain(doc);
  }
}
