import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  categorySchema,
  monthlyPlanSchema,
  recurringRuleSchema,
  settingsSchema,
  transactionSchema,
} from '@finances/shared';
import JSZip from 'jszip';
import type { Model } from 'mongoose';
import { z } from 'zod';
import { COLLECTIONS, MODELS } from '../../../common/database/schemas/collections';
import { EXPORT_SCHEMA_VERSION } from './export.service';

const metadataSchema = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  application: z.literal('finances'),
  exportedAt: z.coerce.date(),
});

export interface ImportSummary {
  strategy: 'REPLACE';
  counts: Record<string, number>;
}

/**
 * Import com estratégia explícita (FR-032): V1 suporta REPLACE (restauração).
 * TUDO é validado pelos schemas do contrato ANTES de tocar o banco — arquivo
 * inválido falha atomicamente sem corromper estado (aceite Fase 18).
 */
@Injectable()
export class ImportService {
  constructor(
    @InjectModel(MODELS.Category) private readonly categories: Model<Record<string, unknown>>,
    @InjectModel(MODELS.Transaction) private readonly transactions: Model<Record<string, unknown>>,
    @InjectModel(MODELS.MonthlyPlan) private readonly plans: Model<Record<string, unknown>>,
    @InjectModel(MODELS.RecurringRule) private readonly rules: Model<Record<string, unknown>>,
    @InjectModel(MODELS.Settings) private readonly settings: Model<Record<string, unknown>>,
  ) {}

  async replaceFromZip(userId: string, zipBuffer: Buffer): Promise<ImportSummary> {
    const parsed = await this.parseAndValidate(zipBuffer);

    // ponto de não-retorno só DEPOIS de todo o arquivo estar validado
    const targets: Array<{ model: Model<Record<string, unknown>>; docs: unknown[] }> = [
      { model: this.categories, docs: parsed.categories },
      { model: this.transactions, docs: parsed.transactions },
      { model: this.plans, docs: parsed.monthlyPlans },
      { model: this.rules, docs: parsed.recurringRules },
      { model: this.settings, docs: parsed.settings },
    ];
    const counts: Record<string, number> = {};
    for (const { model, docs } of targets) {
      await model.deleteMany({ userId });
      if (docs.length > 0) {
        await model.insertMany(
          docs.map((doc) => this.toPersistence(doc as Record<string, unknown>, userId)),
          { ordered: true },
        );
      }
      counts[model.collection.collectionName] = docs.length;
    }
    return { strategy: 'REPLACE', counts };
  }

  private async parseAndValidate(zipBuffer: Buffer) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(zipBuffer);
    } catch {
      throw new BadRequestException({ message: 'Arquivo não é um ZIP válido', reason: 'BAD_ZIP' });
    }
    const readJson = async (name: string): Promise<unknown> => {
      const file = zip.file(name);
      if (!file) {
        throw new BadRequestException({
          message: `Arquivo obrigatório ausente no ZIP: ${name}`,
          reason: 'MISSING_FILE',
        });
      }
      try {
        return JSON.parse(await file.async('string'));
      } catch {
        throw new BadRequestException({ message: `JSON inválido em ${name}`, reason: 'BAD_JSON' });
      }
    };

    const validate = <T>(schema: z.ZodType<T>, value: unknown, name: string): T[] => {
      const result = z.array(schema).safeParse(value);
      if (!result.success) {
        throw new BadRequestException({
          message: `Conteúdo de ${name} não segue o contrato`,
          reason: 'CONTRACT_VIOLATION',
          issues: result.error.issues
            .slice(0, 5)
            .map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        });
      }
      return result.data;
    };

    const metadata = metadataSchema.safeParse(await readJson('metadata.json'));
    if (!metadata.success) {
      throw new BadRequestException({
        message: 'metadata.json inválido ou de versão incompatível',
        reason: 'BAD_METADATA',
      });
    }

    return {
      categories: validate(
        categorySchema,
        await readJson(`${COLLECTIONS.categories}.json`),
        'categories',
      ),
      transactions: validate(
        transactionSchema,
        await readJson(`${COLLECTIONS.transactions}.json`),
        'transactions',
      ),
      monthlyPlans: validate(
        monthlyPlanSchema,
        await readJson(`${COLLECTIONS.monthlyPlans}.json`),
        'monthlyPlans',
      ),
      recurringRules: validate(
        recurringRuleSchema,
        await readJson(`${COLLECTIONS.recurringRules}.json`),
        'recurringRules',
      ),
      settings: validate(
        settingsSchema,
        await readJson(`${COLLECTIONS.settings}.json`),
        'settings',
      ),
    };
  }

  /** Contrato → persistência: id volta a ser _id; posse re-atribuída ao usuário atual. */
  private toPersistence(doc: Record<string, unknown>, userId: string): Record<string, unknown> {
    const { id, monthlyPlanItems, ...rest } = doc;
    const converted: Record<string, unknown> = { ...rest, _id: id, userId };
    if (Array.isArray(monthlyPlanItems)) {
      converted.monthlyPlanItems = monthlyPlanItems.map((item) => {
        const { id: itemId, ...itemRest } = item as Record<string, unknown>;
        return { ...itemRest, _id: itemId };
      });
    }
    return converted;
  }
}
