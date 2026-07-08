import { Money } from '@finances/shared';
import { InstallmentService } from '../src/modules/transactions/services/installment.service';
import type { TransactionsRepository } from '../src/modules/transactions/repository/transactions.repository';
import type { TransactionsService } from '../src/modules/transactions/transactions.service';

const USER = 'b'.repeat(24);
const GROUP = 'e'.repeat(24);

const makeService = () => {
  const createMany = jest
    .fn()
    .mockImplementation((docs: Record<string, unknown>[]) => Promise.resolve(docs));
  const repo = { newId: jest.fn().mockReturnValue(GROUP), createMany };
  const txService = { assertUsableCategory: jest.fn().mockResolvedValue({}) };
  const service = new InstallmentService(
    repo as unknown as TransactionsRepository,
    txService as unknown as TransactionsService,
  );
  return { service, createMany };
};

const input = (overrides: Record<string, unknown> = {}) => ({
  totalAmountCents: 10000,
  installmentTotal: 3,
  description: 'Notebook',
  date: new Date('2026-07-08T15:00:00.000Z'),
  categoryId: 'c'.repeat(24),
  ...overrides,
});

describe('InstallmentService (DOMAIN §6.1)', () => {
  it('divide exatamente: primeiras `resto` parcelas recebem base+1 e Σ == total', async () => {
    const { service, createMany } = makeService();
    await service.createPurchase(USER, input());
    const docs = createMany.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(docs.map((d) => d.amountCents)).toEqual([3334, 3333, 3333]);
    expect(Money.sum(docs.map((d) => Money.fromCents(d.amountCents as number))).cents).toBe(10000);
  });

  it('parcela 1 CONFIRMED (a compra ocorreu); futuras FORECAST; numeração 1..N', async () => {
    const { service, createMany } = makeService();
    await service.createPurchase(USER, input());
    const docs = createMany.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(docs.map((d) => d.status)).toEqual(['CONFIRMED', 'FORECAST', 'FORECAST']);
    expect(docs.map((d) => d.installmentNumber)).toEqual([1, 2, 3]);
    expect(docs.every((d) => d.installmentTotal === 3)).toBe(true);
    expect(docs.every((d) => d.installmentGroupId === GROUP)).toBe(true);
    expect(docs.every((d) => d.type === 'EXPENSE')).toBe(true);
  });

  it('datas: meses subsequentes no mesmo dia, com clamp (31/01 → 28/02 → 31/03)', async () => {
    const { service, createMany } = makeService();
    // 31/01/2026 12:00 em SP == 15:00Z
    await service.createPurchase(USER, input({ date: new Date('2026-01-31T15:00:00.000Z') }));
    const docs = createMany.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect((docs[0]?.date as Date).toISOString()).toBe('2026-01-31T15:00:00.000Z'); // compra exata
    expect((docs[1]?.date as Date).toISOString()).toBe('2026-02-28T03:00:00.000Z'); // clamp fev
    expect((docs[2]?.date as Date).toISOString()).toBe('2026-03-31T03:00:00.000Z'); // volta ao dia 31
  });

  it('valor mínimo: N centavos em N parcelas → todas com exatamente 1 centavo', async () => {
    const { service, createMany } = makeService();
    await service.createPurchase(USER, input({ totalAmountCents: 3, installmentTotal: 3 }));
    const docs = createMany.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(docs.map((d) => d.amountCents)).toEqual([1, 1, 1]);
  });
});
