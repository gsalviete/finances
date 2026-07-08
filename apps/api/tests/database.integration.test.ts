/**
 * Integração da camada de persistência com um mongod REAL (mongodb-memory-server).
 * Cobre os aceites da Fase 8: soft delete por padrão, denormalização month/year
 * na escrita, índices exatos do DATABASE §3 e fronteira ObjectId⇄string.
 */
import {
  transactionSchema,
  categorySchema,
  monthlyPlanSchema,
  type Transaction,
} from '@finances/shared';
import mongoose, { Connection, Model, Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { BaseRepository } from '../src/common/database/base.repository';
import { MODEL_DEFINITIONS } from '../src/common/database/database.module';
import { MODELS } from '../src/common/database/schemas/collections';

jest.setTimeout(120_000);

let mongod: MongoMemoryServer;
let connection: Connection;
const models = new Map<string, Model<Record<string, unknown>>>();

const model = (name: string): Model<Record<string, unknown>> => {
  const found = models.get(name);
  if (!found) throw new Error(`model não registrado: ${name}`);
  return found;
};

const anId = () => new Types.ObjectId();

const transactionData = (overrides: Record<string, unknown> = {}) => ({
  userId: anId(),
  categoryId: anId(),
  type: 'EXPENSE',
  status: 'CONFIRMED',
  amountCents: 4599,
  description: 'Mercado',
  date: new Date('2026-07-08T15:00:00.000Z'),
  origin: 'MANUAL',
  ...overrides,
});

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  connection = mongoose.createConnection(mongod.getUri('finances-test'));
  for (const def of MODEL_DEFINITIONS) {
    models.set(
      def.name,
      connection.model<Record<string, unknown>>(def.name, def.schema, def.collection),
    );
  }
  await Promise.all([...models.values()].map((m) => m.syncIndexes()));
});

afterAll(async () => {
  await connection.close();
  await mongod.stop();
});

describe('índices — exatamente os do DATABASE §3', () => {
  const declaredIndexes = (name: string) =>
    model(name)
      .schema.indexes()
      .map(([keys]) => keys);

  it('transactions possui os 6 índices do contrato, e apenas eles', () => {
    expect(declaredIndexes(MODELS.Transaction)).toEqual([
      { userId: 1, date: -1 },
      { userId: 1, year: 1, month: 1, status: 1 },
      { userId: 1, categoryId: 1 },
      { userId: 1, type: 1, status: 1 },
      { userId: 1, installmentGroupId: 1 },
      { userId: 1, origin: 1 },
    ]);
  });

  it('demais coleções: índices exatos (incluindo únicos) e nenhum extra', () => {
    expect(declaredIndexes(MODELS.RecurringRule)).toEqual([
      { userId: 1, active: 1, dayOfMonth: 1 },
    ]);
    expect(declaredIndexes(MODELS.MonthlyPlan)).toEqual([{ userId: 1, year: 1, month: 1 }]);
    expect(declaredIndexes(MODELS.DraftTransaction)).toEqual([
      { userId: 1, status: 1, createdAt: -1 },
      { userId: 1, clientEventId: 1 },
    ]);
    expect(declaredIndexes(MODELS.Category)).toEqual([{ userId: 1, archived: 1 }]);
    expect(declaredIndexes(MODELS.User)).toEqual([{ email: 1 }]);
    expect(declaredIndexes(MODELS.Settings)).toEqual([]);
    expect(declaredIndexes(MODELS.Backup)).toEqual([]);
  });
});

describe('denormalização month/year na escrita (ADR-005)', () => {
  it('deriva month/year de date no fuso do domínio, ignorando valores do chamador', async () => {
    const doc = await model(MODELS.Transaction).create(
      transactionData({ month: 12, year: 1999 }), // valores mentirosos: o hook prevalece
    );
    expect(doc.get('month')).toBe(7);
    expect(doc.get('year')).toBe(2026);
  });

  it('23h59 do último dia do mês em SP grava no mês local, não no mês UTC', async () => {
    const doc = await model(MODELS.Transaction).create(
      transactionData({ date: new Date('2026-02-01T02:59:00.000Z') }), // 31/01 23:59 em SP
    );
    expect(doc.get('month')).toBe(1);
    expect(doc.get('year')).toBe(2026);
  });

  it('mudança de date via findOneAndUpdate recalcula month/year', async () => {
    const doc = await model(MODELS.Transaction).create(transactionData());
    const updated = await model(MODELS.Transaction).findOneAndUpdate(
      { _id: doc._id },
      { $set: { date: new Date('2026-09-10T15:00:00.000Z') } },
      { new: true },
    );
    expect(updated?.get('month')).toBe(9);
    expect(updated?.get('year')).toBe(2026);
  });
});

describe('soft delete por padrão (ADR-010)', () => {
  it('find/findOne/countDocuments não enxergam deletados; withDeleted enxerga', async () => {
    const userId = anId();
    const alive = await model(MODELS.Category).create(categoryData(userId, 'Viva'));
    await model(MODELS.Category).create({
      ...categoryData(userId, 'Deletada'),
      deletedAt: new Date('2026-07-01T12:00:00.000Z'),
      deletedBy: userId,
    });

    const found = await model(MODELS.Category).find({ userId });
    expect(found.map((c) => c.get('name'))).toEqual(['Viva']);
    expect(await model(MODELS.Category).countDocuments({ userId })).toBe(1);
    expect(await model(MODELS.Category).findOne({ userId, name: 'Deletada' })).toBeNull();

    const all = await model(MODELS.Category).find({ userId }).setOptions({ withDeleted: true });
    expect(all).toHaveLength(2);
    expect(alive.get('deletedAt')).toBeNull();
  });

  it('aggregate também filtra deletados por padrão', async () => {
    const userId = anId();
    await model(MODELS.Category).create(categoryData(userId, 'A'));
    await model(MODELS.Category).create({
      ...categoryData(userId, 'B'),
      deletedAt: new Date('2026-07-01T12:00:00.000Z'),
      deletedBy: userId,
    });
    const result = await model(MODELS.Category).aggregate([
      { $match: { userId } },
      { $count: 'total' },
    ]);
    expect(result[0]?.total).toBe(1);
  });

  function categoryData(userId: Types.ObjectId, name: string) {
    return {
      userId,
      name,
      icon: 'tag',
      color: 'category.blue',
      active: true,
      archived: false,
      sortOrder: 0,
    };
  }
});

describe('índices únicos protegem invariantes', () => {
  it('draftTransactions: clientEventId duplicado por usuário é rejeitado (idempotência)', async () => {
    const userId = anId();
    const draft = {
      userId,
      rawNotification: 'raw',
      parsedData: { amountCents: 100 },
      confidence: 0.9,
      status: 'PENDING',
      clientEventId: 'evt-1',
    };
    await model(MODELS.DraftTransaction).create(draft);
    await expect(model(MODELS.DraftTransaction).create(draft)).rejects.toThrow(/duplicate key/i);
  });

  it('monthlyPlans: um único snapshot por (userId, year, month)', async () => {
    const plan = { userId: anId(), month: 7, year: 2026, archived: false, monthlyPlanItems: [] };
    await model(MODELS.MonthlyPlan).create(plan);
    await expect(model(MODELS.MonthlyPlan).create(plan)).rejects.toThrow(/duplicate key/i);
  });

  it('users: email único', async () => {
    const user = { name: 'G', email: 'dup@x.com', passwordHash: 'h' };
    await model(MODELS.User).create(user);
    await expect(model(MODELS.User).create(user)).rejects.toThrow(/duplicate key/i);
  });
});

describe('BaseRepository — fronteira do contrato (ADR-014)', () => {
  const repo = () => new BaseRepository<Transaction>(model(MODELS.Transaction), transactionSchema);

  it('create/findById devolvem a forma do contrato: ids string, sem _id/__v', async () => {
    const created = await repo().create(transactionData());
    expect(typeof created.id).toBe('string');
    expect(created.id).toMatch(/^[0-9a-f]{24}$/);
    expect(typeof created.userId).toBe('string');
    expect(created).not.toHaveProperty('_id');
    expect(created).not.toHaveProperty('__v');
    expect(created.month).toBe(7);

    const found = await repo().findById(created.id);
    expect(found).toEqual(created);
  });

  it('subdocumentos embutidos também cruzam a fronteira como contrato', async () => {
    const planModel = model(MODELS.MonthlyPlan);
    const raw = await planModel.create({
      userId: anId(),
      month: 8,
      year: 2026,
      archived: false,
      monthlyPlanItems: [
        {
          kind: 'EXPENSE',
          description: 'Aluguel',
          amountCents: 250000,
          categoryId: anId(),
          status: 'PENDING',
          linkedTransactionId: null,
        },
      ],
    });
    const planRepo = new BaseRepository(planModel, monthlyPlanSchema);
    const plan = await planRepo.findById(String(raw._id));
    expect(plan?.monthlyPlanItems[0]?.id).toMatch(/^[0-9a-f]{24}$/);
    expect(typeof plan?.monthlyPlanItems[0]?.categoryId).toBe('string');
  });

  it('findById com id malformado devolve null (nunca CastError)', async () => {
    expect(await repo().findById('não-é-um-objectid')).toBeNull();
  });

  it('softDeleteById esconde da leitura padrão; withDeleted recupera', async () => {
    const created = await repo().create(transactionData());
    const deleted = await repo().softDeleteById(created.id, {
      deletedAt: new Date('2026-07-08T16:00:00.000Z'),
      deletedBy: created.userId,
    });
    expect(deleted?.deletedAt).toBeInstanceOf(Date);
    expect(await repo().findById(created.id)).toBeNull();
    expect(await repo().findById(created.id, { withDeleted: true })).not.toBeNull();
  });

  it('updateById respeita validadores e devolve o contrato atualizado', async () => {
    const created = await repo().create(transactionData());
    const updated = await repo().updateById(created.id, { status: 'CANCELLED' });
    expect(updated?.status).toBe('CANCELLED');
    expect(
      await repo()
        .updateById(created.id, { status: 'INVALIDO' })
        .catch(() => 'erro'),
    ).toBe('erro');
  });

  it('categorySchema também valida a saída (parse na fronteira)', async () => {
    const catRepo = new BaseRepository(model(MODELS.Category), categorySchema);
    const created = await catRepo.create({
      userId: anId(),
      name: 'Lazer',
      icon: 'gamepad-2',
      color: 'category.purple',
      active: true,
      archived: false,
      sortOrder: 0,
    });
    expect(created.name).toBe('Lazer');
    expect(typeof created.userId).toBe('string');
  });
});
