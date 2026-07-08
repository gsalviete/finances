import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('API e2e — health e contrato de erro (Fase 7)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health responde 200 com status ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });

  it('GET /api/v1/health/liveness e /readiness respondem 200', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/liveness').expect(200, { status: 'ok' });
    await request(app.getHttpServer())
      .get('/api/v1/health/readiness')
      .expect(200, { status: 'ok' });
  });

  it('toda resposta carrega x-request-id (e respeita o recebido)', async () => {
    const generated = await request(app.getHttpServer()).get('/api/v1/health');
    expect(generated.headers['x-request-id']).toBeTruthy();

    const propagated = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', 'req-teste-123');
    expect(propagated.headers['x-request-id']).toBe('req-teste-123');
  });

  it('rota fora do prefixo /api/v1 não existe', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('erro segue o envelope padronizado e nunca vaza stacktrace', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/rota-inexistente').expect(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
    expect(res.body.error.details).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain('at ');
    expect(res.body.error.stack).toBeUndefined();
  });
});
