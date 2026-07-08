import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import { MODELS } from '../src/common/database/schemas/collections';

jest.setTimeout(120_000);

describe('Transactions e2e — CRUD, cursor, parcelamento e performance', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;
  let token: string;
  let categoryId: string;
  let userId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-transactions-e2e');
    /* eslint-disable @typescript-eslint/no-require-imports -- env antes do import (ConfigModule valida em import-time) */
    const { Test } = require('@nestjs/testing') as typeof import('@nestjs/testing');
    const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
    const { configureApp } = require('../src/app.setup') as typeof import('../src/app.setup');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Gabriel', email: 'g@x.com', password: 'senha-forte-123' });
    token = register.body.accessToken as string;
    userId = register.body.user.id as string;

    const category = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Geral', icon: 'tag', color: 'category.blue' });
    categoryId = category.body.id as string;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  const api = () => {
    if (!app) throw new Error('app não inicializado');
    return app.getHttpServer();
  };
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const createTx = (body: Record<string, unknown> = {}) =>
    request(api())
      .post('/api/v1/transactions')
      .set(auth())
      .send({
        type: 'EXPENSE',
        amountCents: 4599,
        description: 'Mercado',
        date: '2026-07-08T15:00:00.000Z',
        categoryId,
        ...body,
      });

  it('cria transação manual: origin MANUAL, month/year derivados, default CONFIRMED', async () => {
    const res = await createTx().expect(201);
    expect(res.body.origin).toBe('MANUAL');
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.month).toBe(7);
    expect(res.body.year).toBe(2026);
  });

  it('rejeita valor negativo/zero e categoria ausente (contrato Zod)', async () => {
    await createTx({ amountCents: -100 }).expect(400);
    await createTx({ amountCents: 0 }).expect(400);
    const semCategoria = await request(api()).post('/api/v1/transactions').set(auth()).send({
      type: 'EXPENSE',
      amountCents: 100,
      description: 'x',
      date: '2026-07-08T15:00:00.000Z',
    });
    expect(semCategoria.status).toBe(400);
  });

  it('rejeita categoria expirada com CATEGORY_EXPIRED (ADR-016)', async () => {
    const expired = await request(api())
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'Expirada', icon: 'x', color: 'c', expiresAt: '2020-01-01T00:00:00.000Z' });
    const res = await createTx({ categoryId: expired.body.id }).expect(422);
    expect(res.body.error.details.reason).toBe('CATEGORY_EXPIRED');
  });

  it('confirma e cancela via PATCH; transição inválida → 409', async () => {
    const forecast = await createTx({ status: 'FORECAST' });
    const id = forecast.body.id as string;

    const confirmed = await request(api())
      .patch(`/api/v1/transactions/${id}`)
      .set(auth())
      .send({ status: 'CONFIRMED' })
      .expect(200);
    expect(confirmed.body.status).toBe('CONFIRMED');

    const invalid = await request(api())
      .patch(`/api/v1/transactions/${id}`)
      .set(auth())
      .send({ status: 'FORECAST' })
      .expect(409);
    expect(invalid.body.error.details.reason).toBe('INVALID_STATUS_TRANSITION');

    await request(api())
      .patch(`/api/v1/transactions/${id}`)
      .set(auth())
      .send({ status: 'CANCELLED' })
      .expect(200);
    const immutable = await request(api())
      .patch(`/api/v1/transactions/${id}`)
      .set(auth())
      .send({ description: 'tentativa' })
      .expect(409);
    expect(immutable.body.error.details.reason).toBe('TRANSACTION_CANCELLED');
  });

  it('mudar a data recalcula month/year (hook de escrita)', async () => {
    const tx = await createTx();
    const res = await request(api())
      .patch(`/api/v1/transactions/${tx.body.id}`)
      .set(auth())
      .send({ date: '2026-10-05T15:00:00.000Z' })
      .expect(200);
    expect(res.body.month).toBe(10);
  });

  it('soft delete: some da API, permanece no banco', async () => {
    if (!app) throw new Error('app não inicializado');
    const tx = await createTx();
    await request(api()).delete(`/api/v1/transactions/${tx.body.id}`).set(auth()).expect(204);
    await request(api()).get(`/api/v1/transactions/${tx.body.id}`).set(auth()).expect(404);
    const model = app.get<Model<Record<string, unknown>>>(getModelToken(MODELS.Transaction));
    const raw = await model.findOne({ _id: tx.body.id }).setOptions({ withDeleted: true });
    expect(raw?.get('deletedAt')).not.toBeNull();
  });

  it('parcelamento: 10x de R$ 100,01 → soma exata, 1ª CONFIRMED, futuras FORECAST', async () => {
    const res = await request(api())
      .post('/api/v1/transactions/installments')
      .set(auth())
      .send({
        totalAmountCents: 10001,
        installmentTotal: 10,
        description: 'Notebook',
        date: '2026-07-08T15:00:00.000Z',
        categoryId,
      })
      .expect(201);

    const items = res.body as Array<Record<string, unknown>>;
    expect(items).toHaveLength(10);
    const sum = items.reduce((acc, item) => acc + (item.amountCents as number), 0);
    expect(sum).toBe(10001);
    expect(items[0]?.amountCents).toBe(1001);
    expect(items[0]?.status).toBe('CONFIRMED');
    expect(items.slice(1).every((item) => item.status === 'FORECAST')).toBe(true);
    expect(new Set(items.map((item) => item.installmentGroupId)).size).toBe(1);
    // insertMany também denormaliza month/year (hook de validate)
    expect(items[1]?.month).toBe(8);
    expect(items[9]?.month).toBe(4);
    expect(items[9]?.year).toBe(2027);
  });

  it('editar/cancelar uma parcela não afeta as demais', async () => {
    const res = await request(api()).post('/api/v1/transactions/installments').set(auth()).send({
      totalAmountCents: 3000,
      installmentTotal: 3,
      description: 'Cadeira',
      date: '2026-07-08T15:00:00.000Z',
      categoryId,
    });
    const [first, second, third] = res.body as Array<Record<string, unknown>>;
    await request(api())
      .patch(`/api/v1/transactions/${second?.id}`)
      .set(auth())
      .send({ status: 'CANCELLED' })
      .expect(200);
    const intact = await request(api()).get(`/api/v1/transactions/${third?.id}`).set(auth());
    expect(intact.body.status).toBe('FORECAST');
    const firstIntact = await request(api()).get(`/api/v1/transactions/${first?.id}`).set(auth());
    expect(firstIntact.body.status).toBe('CONFIRMED');
  });

  it('paginação por cursor: percorre tudo sem duplicar nem pular', async () => {
    if (!app) throw new Error('app não inicializado');
    // universo isolado por categoria própria
    const cat = await request(api())
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'Paginada', icon: 'list', color: 'c' });
    const pagCategory = cat.body.id as string;
    const model = app.get<Model<Record<string, unknown>>>(getModelToken(MODELS.Transaction));
    const docs = Array.from({ length: 25 }, (_, i) => ({
      userId,
      categoryId: pagCategory,
      type: 'EXPENSE',
      status: 'CONFIRMED',
      amountCents: 100 + i,
      description: `pg-${i}`,
      date: new Date(Date.UTC(2026, 5, 1 + (i % 20), 12, 0, 0)),
      origin: 'MANUAL',
    }));
    await model.insertMany(docs);

    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const url: string =
        `/api/v1/transactions?limit=7&categoryId=${pagCategory}` +
        (cursor ? `&cursor=${cursor}` : '');
      const page = await request(api()).get(url).set(auth()).expect(200);
      for (const item of page.body.items as Array<{ id: string }>) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      cursor = page.body.nextCursor as string | null;
      pages += 1;
    } while (cursor !== null && pages < 10);

    expect(seen.size).toBe(25);
    expect(pages).toBe(4); // 7+7+7+4
  });

  it('filtros por month/year/status/type funcionam combinados', async () => {
    const res = await request(api())
      .get('/api/v1/transactions?year=2026&month=7&status=CONFIRMED&type=EXPENSE&limit=100')
      .set(auth())
      .expect(200);
    expect(
      (res.body.items as Array<{ month: number; status: string }>).every(
        (t) => t.month === 7 && t.status === 'CONFIRMED',
      ),
    ).toBe(true);
  });

  it('cursor adulterado → 400 BAD_CURSOR', async () => {
    const res = await request(api())
      .get('/api/v1/transactions?cursor=nao-e-um-cursor')
      .set(auth())
      .expect(400);
    expect(res.body.error.details.reason).toBe('BAD_CURSOR');
  });

  it('consulta de 1 ano com índices responde em <200ms (aceite Fase 11)', async () => {
    if (!app) throw new Error('app não inicializado');
    const model = app.get<Model<Record<string, unknown>>>(getModelToken(MODELS.Transaction));
    const bulk = Array.from({ length: 1200 }, (_, i) => ({
      userId,
      categoryId,
      type: i % 3 === 0 ? 'INCOME' : 'EXPENSE',
      status: i % 5 === 0 ? 'FORECAST' : 'CONFIRMED',
      amountCents: 1000 + i,
      description: `perf-${i}`,
      date: new Date(Date.UTC(2025, i % 12, 1 + (i % 27), 12, 0, 0)),
      origin: 'MANUAL',
    }));
    await model.insertMany(bulk);

    const start = process.hrtime.bigint();
    await request(api()).get('/api/v1/transactions?year=2025&limit=100').set(auth()).expect(200);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    expect(elapsedMs).toBeLessThan(200);
  });
});
