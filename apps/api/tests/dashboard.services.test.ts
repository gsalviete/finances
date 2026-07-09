/** Fórmulas do DOMAIN §5 verificadas contra valores calculados à mão. */
import type { Transaction } from '@finances/shared';
import {
  PacingService,
  variableConfirmedSpendCents,
} from '../src/modules/dashboard/services/pacing.service';
import { ProjectionService } from '../src/modules/dashboard/services/projection.service';

const tx = (over: Partial<Transaction>): Transaction =>
  ({
    id: 'a'.repeat(24),
    userId: 'b'.repeat(24),
    categoryId: 'c'.repeat(24),
    type: 'EXPENSE',
    status: 'CONFIRMED',
    amountCents: 0,
    description: '',
    date: new Date('2026-07-10T15:00:00.000Z'),
    month: 7,
    year: 2026,
    origin: 'MANUAL',
    linkedPlanItemId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date('2026-07-10T15:00:00.000Z'),
    updatedAt: new Date('2026-07-10T15:00:00.000Z'),
    ...over,
  }) as Transaction;

// Cenário de referência: salário confirmado +5000,00; aluguel FORECAST −2500,00
// (compromisso); investimento FORECAST −1000,00 (compromisso); mercado confirmado
// variável −300,00. Dia 10 de 31; restam 22.
const monthTransactions = [
  tx({
    type: 'INCOME',
    status: 'CONFIRMED',
    amountCents: 500000,
    linkedPlanItemId: 'd'.repeat(24),
  }),
  tx({ status: 'FORECAST', amountCents: 250000, linkedPlanItemId: 'e'.repeat(24) }),
  tx({ status: 'FORECAST', amountCents: 100000, linkedPlanItemId: 'f'.repeat(24) }),
  tx({ status: 'CONFIRMED', amountCents: 30000 }), // variável (sem linkedPlanItemId)
];

describe('gastoVariavelConfirmado (DOMAIN §5)', () => {
  it('conta apenas EXPENSE CONFIRMED sem linkedPlanItemId', () => {
    expect(variableConfirmedSpendCents(monthTransactions)).toBe(30000);
  });
});

describe('PacingService (FR-003 / §5.2)', () => {
  const service = new PacingService();

  it('cenário de referência: ratio ≈ 0.62 → COMFORTABLE', () => {
    // projetado = 500000−250000−100000−30000 = 120000; pool = 150000
    const result = service.compute({
      projectedCents: 120000,
      monthTransactions,
      daysInMonth: 31,
      elapsedDays: 10,
    });
    expect(result.actualCents).toBe(30000);
    expect(result.expectedCents).toBe(Math.round(150000 * (10 / 31))); // 48387
    expect(result.ratio).toBeCloseTo(30000 / 48387, 5);
    expect(result.status).toBe('COMFORTABLE');
  });

  it.each([
    [0.85, 'COMFORTABLE'],
    [0.9, 'ON_TRACK'],
    [1.05, 'ON_TRACK'],
    [1.2, 'ATTENTION'],
    [1.3, 'ATTENTION'],
    [1.31, 'CRITICAL'],
  ])('faixas default: ratio %f → %s', (ratio, status) => {
    // pool * elapsed/days = 100000 esperado; actual = ratio * esperado
    const actual = Math.round(100000 * ratio);
    const variable = [tx({ status: 'CONFIRMED', amountCents: actual })];
    const result = new PacingService().compute({
      projectedCents: 100000 * 2 - actual, // pool = projected + actual = 200000
      monthTransactions: variable,
      daysInMonth: 2,
      elapsedDays: 1, // esperado = 200000/2 = 100000
    });
    expect(result.status).toBe(status);
  });

  it('consumoEsperado <= 0 → ratio null, ON_TRACK (sem divisão por zero)', () => {
    const result = service.compute({
      projectedCents: -50000,
      monthTransactions: [],
      daysInMonth: 31,
      elapsedDays: 10,
    });
    expect(result.ratio).toBeNull();
    expect(result.status).toBe('ON_TRACK');
  });
});

describe('ProjectionService (FR-005 / §5.3)', () => {
  it('cenário de referência: 4700,00 − 3500,00 − 660,00 = 540,00', () => {
    // saldoAtual = 500000−30000 = 470000; compromissos FORECAST = −350000
    // médiaDiária = 30000/10 = 3000; projVarRestante = 3000×22 = 66000
    const result = new ProjectionService().compute({
      currentCents: 470000,
      monthTransactions,
      elapsedDays: 10,
      remainingDays: 22,
    });
    expect(result.dailyVariableAverageCents).toBe(3000);
    expect(result.remainingCommitmentsCents).toBe(-350000);
    expect(result.endOfMonthCents).toBe(470000 - 350000 - 66000); // 54000
  });

  it('sem gasto variável: projeção = atual + compromissos', () => {
    const onlyCommitments = monthTransactions.filter((t) => t.status === 'FORECAST');
    const result = new ProjectionService().compute({
      currentCents: 100000,
      monthTransactions: onlyCommitments,
      elapsedDays: 1,
      remainingDays: 30,
    });
    expect(result.endOfMonthCents).toBe(100000 - 350000);
  });
});
