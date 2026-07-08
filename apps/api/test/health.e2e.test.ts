import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import request from 'supertest';

jest.setTimeout(120_000);

describe('API e2e — health, readiness com Mongo real e contrato de erro', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    // O env precisa existir ANTES de carregar o AppModule: o ConfigModule valida
    // em import-time. Jest CJS não suporta import() dinâmico, então usamos require.
    process.env.MONGODB_URI = mongod.getUri('finances-e2e');
    /* eslint-disable @typescript-eslint/no-require-imports -- ver comentário acima */
    const { Test } = require('@nestjs/testing') as typeof import('@nestjs/testing');
    const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
    const { configureApp } = require('../src/app.setup') as typeof import('../src/app.setup');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  const server = () => {
    if (!app) throw new Error('app não inicializado');
    return app.getHttpServer();
  };

  it('GET /api/v1/health responde 200 com status ok', async () => {
    const res = await request(server()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });

  it('GET /api/v1/health/liveness responde 200', async () => {
    await request(server()).get('/api/v1/health/liveness').expect(200, { status: 'ok' });
  });

  it('GET /api/v1/health/readiness verifica o MongoDB de verdade', async () => {
    await request(server())
      .get('/api/v1/health/readiness')
      .expect(200, { status: 'ok', mongo: 'up' });
  });

  it('toda resposta carrega x-request-id (e respeita o recebido)', async () => {
    const generated = await request(server()).get('/api/v1/health');
    expect(generated.headers['x-request-id']).toBeTruthy();

    const propagated = await request(server())
      .get('/api/v1/health')
      .set('x-request-id', 'req-teste-123');
    expect(propagated.headers['x-request-id']).toBe('req-teste-123');
  });

  it('rota fora do prefixo /api/v1 não existe', async () => {
    await request(server()).get('/health').expect(404);
  });

  it('erro segue o envelope padronizado e nunca vaza stacktrace', async () => {
    const res = await request(server()).get('/api/v1/rota-inexistente').expect(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(res.body)).not.toContain('at ');
    expect(res.body.error.stack).toBeUndefined();
  });

  it('readiness responde 503 no envelope padrão quando o Mongo cai (por último)', async () => {
    if (!app) throw new Error('app não inicializado');
    const connection = app.get<Connection>(getConnectionToken());
    await connection.close();

    const res = await request(server()).get('/api/v1/health/readiness').expect(503);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });
});
