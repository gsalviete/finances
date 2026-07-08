import type { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

jest.setTimeout(120_000);

describe('Auth e2e — register/login/me (single user V1)', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;

  const credentials = {
    name: 'Gabriel',
    email: 'gsalviete@gmail.com',
    password: 'senha-forte-123',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-auth-e2e');
    /* eslint-disable @typescript-eslint/no-require-imports -- env antes do import (ConfigModule valida em import-time) */
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

  it('POST /auth/register cria o usuário único e devolve sessão sem passwordHash', async () => {
    const res = await request(server()).post('/api/v1/auth/register').send(credentials).expect(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(credentials.email);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain(credentials.password);
  });

  it('POST /auth/register de um segundo usuário é rejeitado (single user)', async () => {
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({ name: 'Intruso', email: 'outro@x.com', password: 'outra-senha-123' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /auth/register com body inválido devolve issues do contrato Zod', async () => {
    const res = await request(server())
      .post('/api/v1/auth/register')
      .send({ name: '', email: 'nao-email', password: '123' })
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    const paths = (res.body.error.details.issues as Array<{ path: string }>).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('POST /auth/login autentica com credenciais corretas', async () => {
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('POST /auth/login com senha errada responde 401 com mensagem genérica', async () => {
    const res = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: 'senha-errada-999' })
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Credenciais inválidas');
  });

  it('GET /auth/me exige token: sem token 401, com token devolve SafeUser', async () => {
    await request(server()).get('/api/v1/auth/me').expect(401);

    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    const res = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(credentials.email);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('GET /auth/me com token adulterado responde 401', async () => {
    await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer token.invalido.aqui')
      .expect(401);
  });
});
