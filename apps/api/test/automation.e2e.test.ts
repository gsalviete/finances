import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

jest.setTimeout(120_000);

describe('Automation e2e — Shortcut→API→Parser→Draft→Inbox→Transaction (Fase 24)', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;
  let token: string;
  let categoryId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-automation-e2e');
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
    const cat = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cartão', icon: 'credit-card', color: 'category.blue' });
    categoryId = cat.body.id as string;
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

  const ingest = (raw: string, eventId: string) =>
    request(api())
      .post('/api/v1/automation/notification')
      .set(auth())
      .send({ rawNotification: raw, clientEventId: eventId });

  it('ingestão parseia e cria draft PENDING; reenvio NÃO duplica (idempotência ADR-006)', async () => {
    const first = await ingest('Compra aprovada: R$ 45,99 em MERCADO X', 'evt-001').expect(201);
    expect(first.body.status).toBe('PENDING');
    expect(first.body.parsedData.amountCents).toBe(4599);
    expect(first.body.confidence).toBe(0.9);

    const retry = await ingest('Compra aprovada: R$ 45,99 em MERCADO X', 'evt-001').expect(201);
    expect(retry.body.id).toBe(first.body.id); // mesmo draft, sem duplicar

    const inbox = await request(api()).get('/api/v1/inbox').set(auth()).expect(200);
    expect(
      (inbox.body as Array<{ clientEventId: string }>).filter((d) => d.clientEventId === 'evt-001'),
    ).toHaveLength(1);
  });

  it('confiança baixa quando não há valor — e nunca inventa (FR-028)', async () => {
    const res = await ingest('Seu cartão foi utilizado', 'evt-002').expect(201);
    expect(res.body.confidence).toBeLessThan(0.7);
    expect(res.body.parsedData.amountCents).toBeUndefined();
  });

  it('fluxo completo: confirmar cria Transaction CONFIRMED com origin AUTOMATION', async () => {
    const draft = await ingest('Você pagou R$ 89,90 no RESTAURANTE Y', 'evt-003').expect(201);
    const tx = await request(api())
      .post(`/api/v1/inbox/${draft.body.id}/confirm`)
      .set(auth())
      .send({ categoryId })
      .expect(201);
    expect(tx.body.origin).toBe('AUTOMATION');
    expect(tx.body.status).toBe('CONFIRMED');
    expect(tx.body.amountCents).toBe(8990);
    expect(tx.body.description).toBe('RESTAURANTE Y');

    // draft sai da Inbox e não pode ser confirmado de novo
    const inbox = await request(api()).get('/api/v1/inbox').set(auth());
    expect((inbox.body as Array<{ id: string }>).some((d) => d.id === draft.body.id)).toBe(false);
    const again = await request(api())
      .post(`/api/v1/inbox/${draft.body.id}/confirm`)
      .set(auth())
      .send({ categoryId })
      .expect(409);
    expect(again.body.error.details.reason).toBe('DRAFT_ALREADY_PROCESSED');
  });

  it('draft sem valor exige amountCents na confirmação (AMOUNT_REQUIRED)', async () => {
    const draft = await ingest('Notificação estranha sem valor', 'evt-004').expect(201);
    const missing = await request(api())
      .post(`/api/v1/inbox/${draft.body.id}/confirm`)
      .set(auth())
      .send({ categoryId })
      .expect(422);
    expect(missing.body.error.details.reason).toBe('AMOUNT_REQUIRED');

    // PUT edita a sugestão; depois confirma
    await request(api())
      .put(`/api/v1/inbox/${draft.body.id}`)
      .set(auth())
      .send({ amountCents: 5000, description: 'Ajustada à mão' })
      .expect(200);
    const tx = await request(api())
      .post(`/api/v1/inbox/${draft.body.id}/confirm`)
      .set(auth())
      .send({ categoryId })
      .expect(201);
    expect(tx.body.amountCents).toBe(5000);
  });

  it('ignore preserva histórico; DELETE descarta o draft', async () => {
    const ignored = await ingest('R$ 10,00 em TESTE A', 'evt-005').expect(201);
    await request(api()).post(`/api/v1/inbox/${ignored.body.id}/ignore`).set(auth()).expect(200);

    const deleted = await ingest('R$ 20,00 em TESTE B', 'evt-006').expect(201);
    await request(api()).delete(`/api/v1/inbox/${deleted.body.id}`).set(auth()).expect(204);

    const inbox = await request(api()).get('/api/v1/inbox').set(auth());
    const ids = (inbox.body as Array<{ id: string }>).map((d) => d.id);
    expect(ids).not.toContain(ignored.body.id);
    expect(ids).not.toContain(deleted.body.id);
  });
});
