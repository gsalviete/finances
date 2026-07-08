import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import { MODELS } from '../src/common/database/schemas/collections';

jest.setTimeout(120_000);

describe('Categories e2e — CRUD escopado, ADR-016 e soft delete', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;
  let token: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-categories-e2e');
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
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  const api = () => {
    if (!app) throw new Error('app não inicializado');
    return app.getHttpServer();
  };
  const auth = { Authorization: '' };
  beforeEach(() => {
    auth.Authorization = `Bearer ${token}`;
  });

  const create = (body: Record<string, unknown>) =>
    request(api()).post('/api/v1/categories').set(auth).send(body);

  it('exige autenticação em todas as rotas', async () => {
    await request(api()).get('/api/v1/categories').expect(401);
    await request(api()).post('/api/v1/categories').send({}).expect(401);
  });

  it('cria categorias e ordena por sortOrder (append no fim sem sortOrder explícito)', async () => {
    await create({ name: 'Mercado', icon: 'shopping-cart', color: 'category.green' }).expect(201);
    await create({ name: 'Aluguel', icon: 'home', color: 'category.blue' }).expect(201);
    const explicit = await create({
      name: 'Prioridade',
      icon: 'star',
      color: 'category.yellow',
      sortOrder: 0,
    }).expect(201);
    expect(explicit.body.sortOrder).toBe(0);

    const list = await request(api()).get('/api/v1/categories').set(auth).expect(200);
    const names = (list.body as Array<{ name: string; sortOrder: number }>).map((c) => c.name);
    // sortOrder: Prioridade=0, Mercado=0? não — Mercado=0 foi o primeiro append; ordena com desempate por name
    expect(names).toEqual(['Mercado', 'Prioridade', 'Aluguel']);
  });

  it('valida entrada pelo contrato Zod', async () => {
    const res = await create({ name: ' ', icon: '', color: 'x' }).expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('PATCH atualiza campos e arquiva/restaura via archived (FR-023/024)', async () => {
    const cat = await create({ name: 'Lazer', icon: 'gamepad-2', color: 'category.purple' });
    const id = cat.body.id as string;

    const renamed = await request(api())
      .patch(`/api/v1/categories/${id}`)
      .set(auth)
      .send({ name: 'Lazer & Cultura' })
      .expect(200);
    expect(renamed.body.name).toBe('Lazer & Cultura');

    await request(api())
      .patch(`/api/v1/categories/${id}`)
      .set(auth)
      .send({ archived: true })
      .expect(200);
    const hidden = await request(api()).get('/api/v1/categories').set(auth);
    expect((hidden.body as Array<{ id: string }>).some((c) => c.id === id)).toBe(false);

    const visible = await request(api()).get('/api/v1/categories?includeArchived=true').set(auth);
    expect((visible.body as Array<{ id: string }>).some((c) => c.id === id)).toBe(true);

    await request(api())
      .patch(`/api/v1/categories/${id}`)
      .set(auth)
      .send({ archived: false })
      .expect(200);
    const restored = await request(api()).get('/api/v1/categories').set(auth);
    expect((restored.body as Array<{ id: string }>).some((c) => c.id === id)).toBe(true);
  });

  it('categoria expirada some do padrão e volta com includeExpired (ADR-016)', async () => {
    const expired = await create({
      name: 'Festa Junina',
      icon: 'party-popper',
      color: 'category.orange',
      expiresAt: '2020-01-01T00:00:00.000Z',
    }).expect(201);

    const byDefault = await request(api()).get('/api/v1/categories').set(auth);
    expect((byDefault.body as Array<{ id: string }>).some((c) => c.id === expired.body.id)).toBe(
      false,
    );

    const withExpired = await request(api())
      .get('/api/v1/categories?includeExpired=true')
      .set(auth);
    expect((withExpired.body as Array<{ id: string }>).some((c) => c.id === expired.body.id)).toBe(
      true,
    );
  });

  it('PATCH body vazio é rejeitado pelo contrato', async () => {
    const cat = await create({ name: 'Temp', icon: 'tag', color: 'c1' });
    await request(api()).patch(`/api/v1/categories/${cat.body.id}`).set(auth).send({}).expect(400);
  });

  it('DELETE de categoria em uso → 409 CATEGORY_IN_USE; histórico permanece', async () => {
    if (!app) throw new Error('app não inicializado');
    const cat = await create({ name: 'Usada', icon: 'tag', color: 'c2' });
    const categoryId = cat.body.id as string;
    const userId = cat.body.userId as string;

    const txModel = app.get<Model<Record<string, unknown>>>(getModelToken(MODELS.Transaction));
    await txModel.create({
      userId,
      categoryId,
      type: 'EXPENSE',
      status: 'CONFIRMED',
      amountCents: 1000,
      description: 'compra',
      date: new Date('2026-07-08T15:00:00.000Z'),
      origin: 'MANUAL',
    });

    const res = await request(api()).delete(`/api/v1/categories/${categoryId}`).set(auth);
    expect(res.status).toBe(409);
    expect(res.body.error.details.reason).toBe('CATEGORY_IN_USE');
    await request(api()).get(`/api/v1/categories/${categoryId}`).set(auth).expect(200);
  });

  it('DELETE de categoria sem uso → 204 (soft delete: some da API, permanece no banco)', async () => {
    if (!app) throw new Error('app não inicializado');
    const cat = await create({ name: 'Descartável', icon: 'tag', color: 'c3' });
    const id = cat.body.id as string;

    await request(api()).delete(`/api/v1/categories/${id}`).set(auth).expect(204);
    await request(api()).get(`/api/v1/categories/${id}`).set(auth).expect(404);

    const catModel = app.get<Model<Record<string, unknown>>>(getModelToken(MODELS.Category));
    const stillThere = await catModel.findOne({ _id: id }).setOptions({ withDeleted: true });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.get('deletedAt')).not.toBeNull();
  });

  it('id malformado → 404 (nunca CastError/500)', async () => {
    await request(api()).get('/api/v1/categories/nao-e-um-id').set(auth).expect(404);
  });
});
