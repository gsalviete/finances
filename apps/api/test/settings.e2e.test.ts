import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

jest.setTimeout(120_000);

describe('Settings e2e (Fase 17)', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;
  let token: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-settings-e2e');
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
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('defaults aplicados na criação do usuário (aceite Fase 17)', async () => {
    const res = await request(api()).get('/api/v1/settings').set(auth()).expect(200);
    expect(res.body).toMatchObject({
      theme: 'system',
      currency: 'BRL',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      backupFrequency: 'WEEKLY',
      animationsEnabled: true,
      motionLevel: 'FULL',
    });
  });

  it('PUT atualiza parcialmente e persiste', async () => {
    await request(api())
      .put('/api/v1/settings')
      .set(auth())
      .send({ theme: 'dark', currency: 'USD', motionLevel: 'REDUCED' })
      .expect(200);
    const res = await request(api()).get('/api/v1/settings').set(auth());
    expect(res.body.theme).toBe('dark');
    expect(res.body.currency).toBe('USD');
    expect(res.body.motionLevel).toBe('REDUCED');
    expect(res.body.language).toBe('pt-BR'); // intocado
  });

  it('valida pelo contrato: tema inválido, timezone falsa e body vazio → 400', async () => {
    await request(api()).put('/api/v1/settings').set(auth()).send({ theme: 'DARK' }).expect(400);
    const tz = await request(api())
      .put('/api/v1/settings')
      .set(auth())
      .send({ timezone: 'America/SaoPaulo' })
      .expect(400);
    expect(JSON.stringify(tz.body)).toContain('IANA');
    await request(api()).put('/api/v1/settings').set(auth()).send({}).expect(400);
  });

  it('exige autenticação', async () => {
    await request(api()).get('/api/v1/settings').expect(401);
  });
});
