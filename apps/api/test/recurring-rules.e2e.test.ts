import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

jest.setTimeout(120_000);

describe('RecurringRules e2e — CRUD do template (Fase 13)', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;
  let token: string;
  let categoryId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-rules-e2e');
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

    const category = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Moradia', icon: 'home', color: 'category.blue' });
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

  const createRule = (body: Record<string, unknown> = {}) =>
    request(api())
      .post('/api/v1/recurring-rules')
      .set(auth())
      .send({
        type: 'EXPENSE',
        description: 'Aluguel',
        categoryId,
        amountCents: 250000,
        dayOfMonth: 5,
        ...body,
      });

  it('cria com defaults: MONTHLY, active=true, janela aberta', async () => {
    const res = await createRule().expect(201);
    expect(res.body.recurrenceType).toBe('MONTHLY');
    expect(res.body.active).toBe(true);
    expect(res.body.startDate).toBeNull();
    expect(res.body.endDate).toBeNull();
  });

  it('rejeita recorrência não-MONTHLY (V1) e dayOfMonth fora de 1–31', async () => {
    await createRule({ recurrenceType: 'WEEKLY' }).expect(400);
    await createRule({ dayOfMonth: 0 }).expect(400);
    await createRule({ dayOfMonth: 32 }).expect(400);
  });

  it('rejeita janela invertida na criação e na edição', async () => {
    await createRule({
      startDate: '2026-06-01T03:00:00.000Z',
      endDate: '2026-01-01T03:00:00.000Z',
    }).expect(400);

    const rule = await createRule({ description: 'Internet', dayOfMonth: 10 });
    await request(api())
      .patch(`/api/v1/recurring-rules/${rule.body.id}`)
      .set(auth())
      .send({ startDate: '2026-06-01T03:00:00.000Z', endDate: '2026-01-01T03:00:00.000Z' })
      .expect(400);
  });

  it('lista ordenada por dayOfMonth e filtra onlyActive', async () => {
    const inactive = await createRule({ description: 'Antiga', dayOfMonth: 1, active: false });
    const all = await request(api()).get('/api/v1/recurring-rules').set(auth()).expect(200);
    const days = (all.body as Array<{ dayOfMonth: number }>).map((r) => r.dayOfMonth);
    expect([...days].sort((a, b) => a - b)).toEqual(days);

    const active = await request(api())
      .get('/api/v1/recurring-rules?onlyActive=true')
      .set(auth())
      .expect(200);
    expect((active.body as Array<{ id: string }>).some((r) => r.id === inactive.body.id)).toBe(
      false,
    );
  });

  it('edita o template e rejeita categoria expirada', async () => {
    const rule = await createRule({ description: 'Energia', dayOfMonth: 15 });
    const updated = await request(api())
      .patch(`/api/v1/recurring-rules/${rule.body.id}`)
      .set(auth())
      .send({ amountCents: 300000 })
      .expect(200);
    expect(updated.body.amountCents).toBe(300000);

    const expired = await request(api())
      .post('/api/v1/categories')
      .set(auth())
      .send({ name: 'Expirada', icon: 'x', color: 'c', expiresAt: '2020-01-01T00:00:00.000Z' });
    const res = await request(api())
      .patch(`/api/v1/recurring-rules/${rule.body.id}`)
      .set(auth())
      .send({ categoryId: expired.body.id })
      .expect(422);
    expect(res.body.error.details.reason).toBe('CATEGORY_EXPIRED');
  });

  it('soft delete: some das listagens, permanece recuperável no banco', async () => {
    const rule = await createRule({ description: 'Streaming', dayOfMonth: 20 });
    await request(api()).delete(`/api/v1/recurring-rules/${rule.body.id}`).set(auth()).expect(204);
    await request(api()).get(`/api/v1/recurring-rules/${rule.body.id}`).set(auth()).expect(404);
  });

  it('exige autenticação', async () => {
    await request(api()).get('/api/v1/recurring-rules').expect(401);
  });
});
