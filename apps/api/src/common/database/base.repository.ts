import type { Model, QueryFilter } from 'mongoose';
import type { ZodType } from 'zod';
import { fromMongoDocument } from './mongo.mapper';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export interface ReadOptions {
  /** Inclui documentos soft-deletados (padrão: nunca — ADR-010). */
  withDeleted?: boolean;
}

export interface SoftDeleteInput {
  deletedAt: Date; // o relógio pertence aos serviços (Clock) — nunca à persistência
  deletedBy: string;
}

/**
 * Repositório base (ARCHITECTURE §2.1, MONOREPO §2 — common/database).
 * Responsabilidades EXCLUSIVAS de persistência: mapeamento ObjectId⇄string,
 * validação de saída pelo schema Zod do contrato e convenção de soft delete.
 * Nenhuma regra de negócio vive aqui.
 */
export class BaseRepository<TDomain extends { id: string }> {
  constructor(
    protected readonly model: Model<Record<string, unknown>>,
    protected readonly contractSchema: ZodType<TDomain>,
  ) {}

  /** Ids malformados nunca chegam ao driver: viram "não encontrado" (sem CastError). */
  protected isValidObjectId(id: string): boolean {
    return OBJECT_ID_PATTERN.test(id);
  }

  protected toDomain(doc: unknown): TDomain {
    const plain =
      typeof (doc as { toObject?: unknown }).toObject === 'function'
        ? (doc as { toObject(): Record<string, unknown> }).toObject()
        : doc;
    return this.contractSchema.parse(fromMongoDocument(plain));
  }

  async create(data: Record<string, unknown>): Promise<TDomain> {
    const doc = await this.model.create(data);
    return this.toDomain(doc);
  }

  async findById(id: string, options: ReadOptions = {}): Promise<TDomain | null> {
    if (!OBJECT_ID_PATTERN.test(id)) return null;
    const doc = await this.model
      .findOne({ _id: id })
      .setOptions({ withDeleted: options.withDeleted === true });
    return doc === null ? null : this.toDomain(doc);
  }

  async findMany(
    filter: QueryFilter<Record<string, unknown>>,
    options: ReadOptions = {},
  ): Promise<TDomain[]> {
    const docs = await this.model
      .find(filter)
      .setOptions({ withDeleted: options.withDeleted === true });
    return docs.map((doc) => this.toDomain(doc));
  }

  async updateById(id: string, update: Record<string, unknown>): Promise<TDomain | null> {
    if (!OBJECT_ID_PATTERN.test(id)) return null;
    const doc = await this.model.findOneAndUpdate(
      { _id: id },
      { $set: update },
      { returnDocument: 'after', runValidators: true },
    );
    return doc === null ? null : this.toDomain(doc);
  }

  /** Exclusão é SEMPRE soft (ADR-010): nada é apagado fisicamente. */
  async softDeleteById(id: string, input: SoftDeleteInput): Promise<TDomain | null> {
    return this.updateById(id, { deletedAt: input.deletedAt, deletedBy: input.deletedBy });
  }
}
