import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import JSZip from 'jszip';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

jest.setTimeout(120_000);

describe('Backup e2e — export ZIP, import REPLACE, provider Local (Fase 18)', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;
  let token: string;
  let categoryId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-backup-e2e');
    process.env.BACKUP_PROVIDER = 'LOCAL';
    process.env.BACKUP_LOCAL_DIR = join(tmpdir(), `finances-backup-test-${process.pid}`);
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
      .send({ name: 'Mercado', icon: 'shopping-cart', color: 'category.green' });
    categoryId = cat.body.id as string;

    await request(app.getHttpServer())
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'EXPENSE',
        amountCents: 4599,
        description: 'Compra do mês',
        date: '2026-07-08T15:00:00.000Z',
        categoryId,
      });
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

  let exportedZip: Buffer;

  it('GET /backup/export baixa ZIP com as 6 coleções + metadata, sem dados sensíveis', async () => {
    const res = await request(api())
      .get('/api/v1/backup/export')
      .set(auth())
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    exportedZip = res.body as Buffer;
    expect(res.headers['content-type']).toContain('application/zip');

    const zip = await JSZip.loadAsync(exportedZip);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual([
      'categories.json',
      'metadata.json',
      'monthlyPlans.json',
      'recurringRules.json',
      'settings.json',
      'transactions.json',
      'wishlistItems.json', // ADR-018
    ]);
    const all = (await Promise.all(names.map((name) => zip.file(name)!.async('string')))).join('');
    expect(all).not.toContain('passwordHash');
    expect(all).not.toContain('senha-forte-123');

    const txs = JSON.parse(await zip.file('transactions.json')!.async('string')) as Array<{
      description: string;
    }>;
    expect(txs.some((t) => t.description === 'Compra do mês')).toBe(true);
  });

  it('round-trip: apaga tudo → import REPLACE → dados restaurados (aceite Fase 18)', async () => {
    // "corrompe" o estado: renomeia a categoria e cria transação extra
    await request(api())
      .patch(`/api/v1/categories/${categoryId}`)
      .set(auth())
      .send({ name: 'Renomeada' })
      .expect(200);
    await request(api())
      .post('/api/v1/transactions')
      .set(auth())
      .send({
        type: 'EXPENSE',
        amountCents: 100,
        description: 'extra pós-export',
        date: '2026-07-09T15:00:00.000Z',
        categoryId,
      })
      .expect(201);

    const summary = await request(api())
      .post('/api/v1/backup/import')
      .set(auth())
      .field('strategy', 'REPLACE')
      .attach('file', exportedZip, 'export.zip')
      .expect(201);
    expect(summary.body.strategy).toBe('REPLACE');

    const cat = await request(api()).get(`/api/v1/categories/${categoryId}`).set(auth());
    expect(cat.body.name).toBe('Mercado'); // restaurado
    const txs = await request(api()).get('/api/v1/transactions?limit=100').set(auth());
    const descriptions = (txs.body.items as Array<{ description: string }>).map(
      (t) => t.description,
    );
    expect(descriptions).toContain('Compra do mês');
    expect(descriptions).not.toContain('extra pós-export'); // REPLACE substitui tudo
  });

  it('import sem strategy explícita → 400; ZIP inválido falha sem corromper estado', async () => {
    await request(api())
      .post('/api/v1/backup/import')
      .set(auth())
      .attach('file', Buffer.from('nao-e-zip'), 'x.zip')
      .expect(400);

    const bad = await request(api())
      .post('/api/v1/backup/import')
      .set(auth())
      .field('strategy', 'REPLACE')
      .attach('file', Buffer.from('nao-e-zip'), 'x.zip')
      .expect(400);
    expect(bad.body.error.details.reason).toBe('BAD_ZIP');

    // ZIP válido mas com contrato violado também falha atomicamente
    const zip = new JSZip();
    zip.file(
      'metadata.json',
      JSON.stringify({
        schemaVersion: 1,
        application: 'finances',
        exportedAt: '2026-07-08T00:00:00.000Z',
      }),
    );
    zip.file('categories.json', JSON.stringify([{ nome: 'inválida' }]));
    zip.file('transactions.json', '[]');
    zip.file('monthlyPlans.json', '[]');
    zip.file('recurringRules.json', '[]');
    zip.file('settings.json', '[]');
    const invalid = await zip.generateAsync({ type: 'nodebuffer' });
    const res = await request(api())
      .post('/api/v1/backup/import')
      .set(auth())
      .field('strategy', 'REPLACE')
      .attach('file', invalid, 'invalid.zip')
      .expect(400);
    expect(res.body.error.details.reason).toBe('CONTRACT_VIOLATION');

    // estado permanece íntegro
    const cat = await request(api()).get(`/api/v1/categories/${categoryId}`).set(auth());
    expect(cat.body.name).toBe('Mercado');
  });

  it('POST /backup/run grava artefato via provider Local e registra metadados', async () => {
    const res = await request(api()).post('/api/v1/backup/run').set(auth()).expect(201);
    expect(res.body.providerType).toBe('LOCAL');
    expect(res.body.sizeBytes).toBeGreaterThan(0);
    expect(res.body.checksum).toMatch(/^sha256:/);
    const artifact = await readFile(res.body.location as string);
    expect(artifact.byteLength).toBe(res.body.sizeBytes);
  });
});
