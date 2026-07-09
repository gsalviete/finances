import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import JSZip from 'jszip';
import type { Model } from 'mongoose';
import { fromMongoDocument } from '../../../common/database/mongo.mapper';
import { COLLECTIONS, MODELS } from '../../../common/database/schemas/collections';

export const EXPORT_SCHEMA_VERSION = 1;

/** Coleções exportadas (FR-031). users/backups/drafts ficam de fora; nada sensível sai. */
export const EXPORTED_COLLECTIONS = [
  { model: MODELS.Category, file: `${COLLECTIONS.categories}.json` },
  { model: MODELS.Transaction, file: `${COLLECTIONS.transactions}.json` },
  { model: MODELS.MonthlyPlan, file: `${COLLECTIONS.monthlyPlans}.json` },
  { model: MODELS.RecurringRule, file: `${COLLECTIONS.recurringRules}.json` },
  { model: MODELS.Settings, file: `${COLLECTIONS.settings}.json` },
] as const;

export interface ExportArtifact {
  buffer: Buffer;
  checksum: string;
  counts: Record<string, number>;
}

@Injectable()
export class ExportService {
  constructor(
    @InjectModel(MODELS.Category) private readonly categories: Model<Record<string, unknown>>,
    @InjectModel(MODELS.Transaction) private readonly transactions: Model<Record<string, unknown>>,
    @InjectModel(MODELS.MonthlyPlan) private readonly plans: Model<Record<string, unknown>>,
    @InjectModel(MODELS.RecurringRule) private readonly rules: Model<Record<string, unknown>>,
    @InjectModel(MODELS.Settings) private readonly settings: Model<Record<string, unknown>>,
  ) {}

  /** ZIP com um JSON por coleção + metadata. Inclui soft-deletados (fidelidade total). */
  async buildArtifact(userId: string, exportedAt: Date): Promise<ExportArtifact> {
    const zip = new JSZip();
    const counts: Record<string, number> = {};
    const models: Record<string, Model<Record<string, unknown>>> = {
      [MODELS.Category]: this.categories,
      [MODELS.Transaction]: this.transactions,
      [MODELS.MonthlyPlan]: this.plans,
      [MODELS.RecurringRule]: this.rules,
      [MODELS.Settings]: this.settings,
    };

    for (const { model, file } of EXPORTED_COLLECTIONS) {
      const docs = await models[model]!.find({ userId }).setOptions({ withDeleted: true }).lean();
      const converted = docs.map((doc) => fromMongoDocument(doc));
      counts[file.replace('.json', '')] = converted.length;
      zip.file(file, JSON.stringify(converted, null, 2));
    }

    zip.file(
      'metadata.json',
      JSON.stringify(
        {
          schemaVersion: EXPORT_SCHEMA_VERSION,
          exportedAt: exportedAt.toISOString(),
          application: 'finances',
          counts,
        },
        null,
        2,
      ),
    );

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const checksum = `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
    return { buffer, checksum, counts };
  }
}
