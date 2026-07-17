import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { ExtractedMetadata } from '../src/modules/wishlist/product-metadata/html-metadata.parser';

jest.setTimeout(120_000);

// URL pública por IP literal: o SSRF guard real roda sem tocar DNS/rede
const PRODUCT_URL = 'https://93.184.216.34/produto/fone-xyz';

/** Stub do extractor: e2e nunca faz fetch externo; cenário controlado por teste. */
const extractMock = jest.fn<Promise<ExtractedMetadata>, [string]>();

describe('Wishlist e2e — cadastro por URL, refresh, edição manual e soft delete (ADR-018)', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;
  let token: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-wishlist-e2e');
    /* eslint-disable @typescript-eslint/no-require-imports -- env antes do import (ConfigModule valida em import-time) */
    const { Test } = require('@nestjs/testing') as typeof import('@nestjs/testing');
    const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
    const { configureApp } = require('../src/app.setup') as typeof import('../src/app.setup');
    const { ProductMetadataService } =
      require('../src/modules/wishlist/product-metadata/product-metadata.service') as typeof import('../src/modules/wishlist/product-metadata/product-metadata.service');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ProductMetadataService)
      .useValue({ extract: extractMock })
      .compile();
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

  beforeEach(() => {
    extractMock.mockReset();
  });

  const api = () => {
    if (!app) throw new Error('app não inicializado');
    return app.getHttpServer();
  };
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('exige autenticação em todas as rotas', async () => {
    await request(api()).get('/api/v1/wishlist').expect(401);
    await request(api()).post('/api/v1/wishlist').send({}).expect(401);
  });

  it('rejeita URL privada/loopback com 400 antes de qualquer fetch', async () => {
    const res = await request(api())
      .post('/api/v1/wishlist')
      .set(auth())
      .send({ url: 'http://127.0.0.1/admin' })
      .expect(400);
    expect(res.body.error.details.reason).toBe('URL_NOT_ALLOWED');
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('cadastra com extração completa: snapshot OK, preço em centavos inteiros', async () => {
    extractMock.mockResolvedValueOnce({
      name: 'Fone XYZ',
      imageUrl: 'https://cdn.example.com/fone.jpg',
      priceCents: 129990,
      currency: 'BRL',
    });
    const res = await request(api())
      .post('/api/v1/wishlist')
      .set(auth())
      .send({ url: PRODUCT_URL, priority: 'HIGH' })
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Fone XYZ',
      priceCents: 129990,
      currency: 'BRL',
      priority: 'HIGH',
      scrapeStatus: 'OK',
    });
    expect(res.body.scrapedAt).not.toBeNull();
  });

  it('extração vazia NUNCA bloqueia o cadastro: item FAILED com placeholder editável', async () => {
    extractMock.mockResolvedValueOnce({
      name: null,
      imageUrl: null,
      priceCents: null,
      currency: null,
    });
    const res = await request(api())
      .post('/api/v1/wishlist')
      .set(auth())
      .send({ url: `${PRODUCT_URL}?v=failed` })
      .expect(201);
    expect(res.body).toMatchObject({
      name: '93.184.216.34', // hostname como placeholder
      priceCents: null,
      currency: 'BRL', // default de settings do usuário
      priority: 'MEDIUM',
      scrapeStatus: 'FAILED',
      scrapedAt: null,
    });

    // edição manual completa o item
    const patched = await request(api())
      .patch(`/api/v1/wishlist/${res.body.id}`)
      .set(auth())
      .send({ name: 'Teclado Manual', priceCents: 45000 })
      .expect(200);
    expect(patched.body).toMatchObject({ name: 'Teclado Manual', priceCents: 45000 });
  });

  it('lista ordenada por prioridade (HIGH antes de MEDIUM)', async () => {
    const res = await request(api()).get('/api/v1/wishlist').set(auth()).expect(200);
    const priorities = (res.body as Array<{ priority: string }>).map((item) => item.priority);
    expect(priorities).toEqual(
      [...priorities].sort((a, b) => 'HML'.indexOf(a[0]!) - 'HML'.indexOf(b[0]!)),
    );
    expect(priorities).toContain('HIGH');
  });

  it('refresh re-extrai e atualiza snapshot; falha de refresh não apaga dados', async () => {
    extractMock.mockResolvedValueOnce({
      name: 'Fone XYZ v2',
      imageUrl: null,
      priceCents: 99990,
      currency: 'BRL',
    });
    const list = await request(api()).get('/api/v1/wishlist').set(auth()).expect(200);
    const item = (list.body as Array<{ id: string; name: string }>).find(
      (i) => i.name === 'Fone XYZ',
    );
    expect(item).toBeDefined();

    const refreshed = await request(api())
      .post(`/api/v1/wishlist/${item!.id}/refresh`)
      .set(auth())
      .expect(200);
    expect(refreshed.body).toMatchObject({
      name: 'Fone XYZ v2',
      priceCents: 99990,
      scrapeStatus: 'PARTIAL',
    });
    // imagem antiga preservada: refresh só sobrescreve o que extraiu
    expect(refreshed.body.imageUrl).toBe('https://cdn.example.com/fone.jpg');

    extractMock.mockResolvedValueOnce({
      name: null,
      imageUrl: null,
      priceCents: null,
      currency: null,
    });
    const failed = await request(api())
      .post(`/api/v1/wishlist/${item!.id}/refresh`)
      .set(auth())
      .expect(200);
    expect(failed.body).toMatchObject({
      name: 'Fone XYZ v2',
      priceCents: 99990,
      scrapeStatus: 'FAILED',
    });
  });

  it('valida entrada pelo contrato Zod (url obrigatória e http(s))', async () => {
    await request(api()).post('/api/v1/wishlist').set(auth()).send({}).expect(400);
    await request(api())
      .post('/api/v1/wishlist')
      .set(auth())
      .send({ url: 'ftp://example.com/x' })
      .expect(400);
    await request(api())
      .patch('/api/v1/wishlist/ffffffffffffffffffffffff')
      .set(auth())
      .send({})
      .expect(400); // ao menos um campo
  });

  it('soft delete: item some da listagem e não é apagado fisicamente', async () => {
    const list = await request(api()).get('/api/v1/wishlist').set(auth()).expect(200);
    const target = (list.body as Array<{ id: string }>)[0]!;
    await request(api()).delete(`/api/v1/wishlist/${target.id}`).set(auth()).expect(204);
    const after = await request(api()).get('/api/v1/wishlist').set(auth()).expect(200);
    expect((after.body as Array<{ id: string }>).map((i) => i.id)).not.toContain(target.id);
    await request(api()).get(`/api/v1/wishlist/${target.id}`).set(auth()).expect(404);
  });
});
