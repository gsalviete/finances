/**
 * Arco Fases 14–16 com relógio congelado em 2026-07-10 12:00 (SP):
 * virada de mês idempotente → materialização FORECAST → auto-confirmação →
 * NÃO-DOUBLE-COUNT → edição do plano → dashboard com valores calculados à mão.
 */
import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { fixedClock } from '@finances/shared';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import { CLOCK } from '../src/common/clock/clock.module';
import { MODELS } from '../src/common/database/schemas/collections';

jest.setTimeout(120_000);

// 2026-07-10T12:00 em SP == 15:00Z. Julho tem 31 dias: decorridos 10, restantes 22.
const NOW = new Date('2026-07-10T15:00:00.000Z');

describe('Planning + Dashboard e2e (Fases 14–16)', () => {
  let app: INestApplication | undefined;
  let mongod: MongoMemoryServer | undefined;
  let token: string;
  let incomeCat: string;
  let housingCat: string;
  let investCat: string;
  let groceriesCat: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('finances-planning-e2e');
    /* eslint-disable @typescript-eslint/no-require-imports -- env antes do import (ConfigModule valida em import-time) */
    const { Test } = require('@nestjs/testing') as typeof import('@nestjs/testing');
    const { AppModule } = require('../src/app.module') as typeof import('../src/app.module');
    const { configureApp } = require('../src/app.setup') as typeof import('../src/app.setup');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(fixedClock(NOW))
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Gabriel', email: 'g@x.com', password: 'senha-forte-123' });
    token = register.body.accessToken as string;

    const mkCat = async (name: string) => {
      const res = await request(app!.getHttpServer())
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({ name, icon: 'tag', color: 'category.blue' });
      return res.body.id as string;
    };
    incomeCat = await mkCat('Salário');
    housingCat = await mkCat('Moradia');
    investCat = await mkCat('Investimentos');
    groceriesCat = await mkCat('Mercado');

    const mkRule = (body: Record<string, unknown>) =>
      request(app!.getHttpServer())
        .post('/api/v1/recurring-rules')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(201);

    await mkRule({
      type: 'INCOME',
      description: 'Salário',
      categoryId: incomeCat,
      amountCents: 500000,
      dayOfMonth: 5, // já passou → auto-confirma
    });
    await mkRule({
      type: 'EXPENSE',
      description: 'Aluguel',
      categoryId: housingCat,
      amountCents: 250000,
      dayOfMonth: 20, // futuro → permanece FORECAST
    });
    await mkRule({
      type: 'EXPENSE',
      investment: true,
      description: 'Aporte mensal',
      categoryId: investCat,
      amountCents: 100000,
      dayOfMonth: 25, // futuro
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
  const txModel = () => app!.get<Model<Record<string, unknown>>>(getModelToken(MODELS.Transaction));

  interface PlanItem {
    id: string;
    kind: string;
    description: string;
    amountCents: number;
    categoryId: string;
    status: string;
    linkedTransactionId: string | null;
  }

  it('GET /planning materializa o snapshot: itens PENDING + FORECAST vinculados (ADR-017)', async () => {
    const res = await request(api()).get('/api/v1/planning').set(auth()).expect(200);
    const items = res.body.monthlyPlanItems as PlanItem[];
    expect(res.body.year).toBe(2026);
    expect(res.body.month).toBe(7);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.kind).sort()).toEqual(['EXPENSE', 'INCOME', 'INVESTMENT']);
    expect(items.every((i) => i.linkedTransactionId !== null)).toBe(true);

    // regra investment → item INVESTMENT, mas Transaction EXPENSE (FR-013)
    const investItem = items.find((i) => i.kind === 'INVESTMENT');
    const investTx = await request(api())
      .get(`/api/v1/transactions/${investItem?.linkedTransactionId}`)
      .set(auth());
    expect(investTx.body.type).toBe('EXPENSE');
    expect(investTx.body.date).toBe('2026-07-25T03:00:00.000Z'); // dia 25, meia-noite SP

    // auto-confirmação lazy: salário (dia 5) já virou CONFIRMED → item PAID
    const salaryItem = items.find((i) => i.kind === 'INCOME');
    expect(salaryItem?.status).toBe('PAID');
    const rentItem = items.find((i) => i.kind === 'EXPENSE');
    expect(rentItem?.status).toBe('PENDING');
  });

  it('virada é idempotente: reler e forçar POST não duplica nada (aceite Fase 14)', async () => {
    const before = await txModel().countDocuments({});
    const first = await request(api()).get('/api/v1/planning').set(auth());
    await request(api())
      .post('/api/v1/planning')
      .set(auth())
      .send({ year: 2026, month: 7 })
      .expect(201);
    const second = await request(api()).get('/api/v1/planning').set(auth());
    expect(second.body.id).toBe(first.body.id);
    expect(await txModel().countDocuments({})).toBe(before);
  });

  it('editar a regra depois NÃO altera o snapshot congelado (DOMAIN §3.5)', async () => {
    const rules = await request(api()).get('/api/v1/recurring-rules').set(auth());
    const rent = (rules.body as Array<{ id: string; description: string }>).find(
      (r) => r.description === 'Aluguel',
    );
    await request(api())
      .patch(`/api/v1/recurring-rules/${rent?.id}`)
      .set(auth())
      .send({ amountCents: 999999 })
      .expect(200);
    const plan = await request(api()).get('/api/v1/planning').set(auth());
    const rentItem = (plan.body.monthlyPlanItems as PlanItem[]).find(
      (i) => i.description === 'Aluguel',
    );
    expect(rentItem?.amountCents).toBe(250000); // congelado
  });

  it('dashboard: 3 lentes e indicadores batem com o cálculo manual', async () => {
    // gasto variável: mercado 300,00 confirmado
    await request(api())
      .post('/api/v1/transactions')
      .set(auth())
      .send({
        type: 'EXPENSE',
        amountCents: 30000,
        description: 'Mercado',
        date: '2026-07-08T15:00:00.000Z',
        categoryId: groceriesCat,
      })
      .expect(201);

    const res = await request(api()).get('/api/v1/dashboard').set(auth()).expect(200);
    const dash = res.body;
    // projetado = 5000 − 2500 − 1000 − 300 = 1200,00 (herói)
    expect(dash.projectedBalanceCents).toBe(120000);
    // atual = 5000 (auto-confirmado) − 300 = 4700,00
    expect(dash.currentBalanceCents).toBe(470000);
    // planejado = 5000 − 2500 − 1000 = 1500,00
    expect(dash.plannedAvailableCents).toBe(150000);
    expect(dash.monthProgress).toEqual({ daysInMonth: 31, elapsedDays: 10, remainingDays: 22 });
    expect(dash.dailyBudgetCents).toBe(Math.floor(120000 / 22)); // 5454
    expect(dash.pacing.actualCents).toBe(30000);
    expect(dash.pacing.expectedCents).toBe(Math.round(150000 * (10 / 31)));
    expect(dash.pacing.status).toBe('COMFORTABLE');
    expect(dash.projection.endOfMonthCents).toBe(470000 - 350000 - 66000); // 540,00
    expect(dash.topCategories).toHaveLength(1);
    expect(dash.topCategories[0].name).toBe('Mercado');
    expect(dash.topCategories[0].percentage).toBe(100);
    expect(dash.recentTransactions.length).toBeGreaterThan(0);
  });

  it('NÃO-DOUBLE-COUNT: confirmar o aluguel não re-subtrai do Projetado (aceite Fase 15)', async () => {
    const before = await request(api()).get('/api/v1/dashboard').set(auth());
    const plan = await request(api()).get('/api/v1/planning').set(auth());
    const rentItem = (plan.body.monthlyPlanItems as PlanItem[]).find(
      (i) => i.description === 'Aluguel',
    );

    await request(api())
      .patch(`/api/v1/transactions/${rentItem?.linkedTransactionId}`)
      .set(auth())
      .send({ status: 'CONFIRMED' })
      .expect(200);

    const after = await request(api()).get('/api/v1/dashboard').set(auth());
    // Projetado INALTERADO: o compromisso já estava contado como FORECAST
    expect(after.body.projectedBalanceCents).toBe(before.body.projectedBalanceCents);
    // Atual absorve o aluguel: 4700 − 2500 = 2200,00
    expect(after.body.currentBalanceCents).toBe(220000);

    // promoção PENDING→PAID na leitura seguinte do plano
    const planAfter = await request(api()).get('/api/v1/planning').set(auth());
    const rentAfter = (planAfter.body.monthlyPlanItems as PlanItem[]).find(
      (i) => i.description === 'Aluguel',
    );
    expect(rentAfter?.status).toBe('PAID');
  });

  it('PUT /planning: edita item PENDING (propaga ao FORECAST), adiciona novo e protege PAID', async () => {
    const plan = await request(api()).get('/api/v1/planning').set(auth());
    const items = plan.body.monthlyPlanItems as PlanItem[];
    const invest = items.find((i) => i.kind === 'INVESTMENT');
    const salary = items.find((i) => i.kind === 'INCOME');
    const rent = items.find((i) => i.description === 'Aluguel');

    // aumenta o aporte 1000,00 → 1200,00 e adiciona compromisso novo de 500,00
    const updated = await request(api())
      .put('/api/v1/planning')
      .set(auth())
      .send({
        year: 2026,
        month: 7,
        monthlyPlanItems: [
          {
            id: salary?.id,
            kind: 'INCOME',
            description: 'Salário',
            amountCents: 500000,
            categoryId: incomeCat,
          },
          {
            id: rent?.id,
            kind: 'EXPENSE',
            description: 'Aluguel',
            amountCents: 250000,
            categoryId: housingCat,
          },
          {
            id: invest?.id,
            kind: 'INVESTMENT',
            description: 'Aporte mensal',
            amountCents: 120000,
            categoryId: investCat,
          },
          { kind: 'EXPENSE', description: 'Seguro', amountCents: 50000, categoryId: housingCat },
        ],
      })
      .expect(200);

    const newItems = updated.body.monthlyPlanItems as PlanItem[];
    expect(newItems).toHaveLength(4);
    const seguro = newItems.find((i) => i.description === 'Seguro');
    expect(seguro?.status).toBe('PENDING');
    expect(seguro?.linkedTransactionId).not.toBeNull();

    // FORECAST do aporte foi atualizado junto (mesmo compromisso, lentes coerentes)
    const investTx = await request(api())
      .get(`/api/v1/transactions/${invest?.linkedTransactionId}`)
      .set(auth());
    expect(investTx.body.amountCents).toBe(120000);

    // dashboard reflete na leitura seguinte: projetado 1200 − 200 (aporte) − 500 (seguro)
    const dash = await request(api()).get('/api/v1/dashboard').set(auth());
    expect(dash.body.projectedBalanceCents).toBe(120000 - 20000 - 50000);
    expect(dash.body.plannedAvailableCents).toBe(150000 - 20000 - 50000);

    // item PAID é imutável
    const blocked = await request(api())
      .put('/api/v1/planning')
      .set(auth())
      .send({
        year: 2026,
        month: 7,
        monthlyPlanItems: newItems.map((i) => ({
          id: i.id,
          kind: i.kind,
          description: i.description,
          amountCents: i.description === 'Salário' ? 1 : i.amountCents,
          categoryId: i.categoryId,
        })),
      })
      .expect(409);
    expect(blocked.body.error.details.reason).toBe('PLAN_ITEM_PAID_IMMUTABLE');
  });

  it('remover item PENDING cancela o FORECAST vinculado (sem buraco nas lentes)', async () => {
    const plan = await request(api()).get('/api/v1/planning').set(auth());
    const items = plan.body.monthlyPlanItems as PlanItem[];
    const seguro = items.find((i) => i.description === 'Seguro');
    const kept = items.filter((i) => i.description !== 'Seguro');

    await request(api())
      .put('/api/v1/planning')
      .set(auth())
      .send({
        year: 2026,
        month: 7,
        monthlyPlanItems: kept.map((i) => ({
          id: i.id,
          kind: i.kind,
          description: i.description,
          amountCents: i.amountCents,
          categoryId: i.categoryId,
        })),
      })
      .expect(200);

    const cancelled = await request(api())
      .get(`/api/v1/transactions/${seguro?.linkedTransactionId}`)
      .set(auth());
    expect(cancelled.body.status).toBe('CANCELLED');

    const dash = await request(api()).get('/api/v1/dashboard').set(auth());
    expect(dash.body.projectedBalanceCents).toBe(120000 - 20000); // seguro saiu das lentes
  });

  it('mês passado sem snapshot: GET → 404; POST cria explicitamente', async () => {
    await request(api()).get('/api/v1/planning?year=2026&month=5').set(auth()).expect(404);
    const created = await request(api())
      .post('/api/v1/planning')
      .set(auth())
      .send({ year: 2026, month: 5 })
      .expect(201);
    expect(created.body.month).toBe(5);
  });
});
