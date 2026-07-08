import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { fixedClock, type Category, type Transaction } from '@finances/shared';
import type { CategoriesRepository } from '../src/modules/categories/repository/categories.repository';
import type { TransactionsRepository } from '../src/modules/transactions/repository/transactions.repository';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

const USER = 'b'.repeat(24);
const NOW = new Date('2026-07-08T15:00:00.000Z');
const OID = 'a'.repeat(24);

const category = (overrides: Partial<Category> = {}): Category => ({
  id: 'c'.repeat(24),
  userId: USER,
  name: 'Mercado',
  icon: 'shopping-cart',
  color: 'category.green',
  active: true,
  archived: false,
  sortOrder: 0,
  expiresAt: null,
  deletedAt: null,
  deletedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: OID,
  userId: USER,
  categoryId: 'c'.repeat(24),
  type: 'EXPENSE',
  status: 'CONFIRMED',
  amountCents: 4599,
  description: 'Mercado',
  date: NOW,
  month: 7,
  year: 2026,
  origin: 'MANUAL',
  linkedPlanItemId: null,
  installmentGroupId: null,
  installmentNumber: null,
  installmentTotal: null,
  deletedAt: null,
  deletedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const makeService = (
  repo: Partial<Record<keyof TransactionsRepository, jest.Mock>>,
  cat: Category | null = category(),
) => {
  const categoriesRepo = {
    findByIdForUser: jest.fn().mockResolvedValue(cat),
  } as unknown as CategoriesRepository;
  return new TransactionsService(
    repo as unknown as TransactionsRepository,
    categoriesRepo,
    fixedClock(NOW),
  );
};

describe('TransactionsService — criação', () => {
  it('cria com origin MANUAL e categoria validada', async () => {
    const create = jest.fn().mockResolvedValue(transaction());
    const service = makeService({ create });
    await service.create(USER, {
      type: 'EXPENSE',
      status: 'CONFIRMED',
      amountCents: 4599,
      description: 'Mercado',
      date: NOW,
      categoryId: 'c'.repeat(24),
    });
    expect((create.mock.calls[0]?.[0] as Record<string, unknown>).origin).toBe('MANUAL');
  });

  it('rejeita categoria inexistente (CATEGORY_NOT_FOUND) e expirada (CATEGORY_EXPIRED)', async () => {
    const missing = makeService({}, null);
    const expired = makeService({}, category({ expiresAt: new Date('2020-01-01T00:00:00Z') }));
    const base = {
      type: 'EXPENSE' as const,
      status: 'CONFIRMED' as const,
      amountCents: 100,
      description: 'x',
      date: NOW,
      categoryId: 'c'.repeat(24),
    };
    await expect(missing.create(USER, base)).rejects.toBeInstanceOf(UnprocessableEntityException);
    const error = await expired.create(USER, base).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(
      ((error as UnprocessableEntityException).getResponse() as Record<string, unknown>).reason,
    ).toBe('CATEGORY_EXPIRED');
  });

  it('categoria expirando no futuro ainda é utilizável', async () => {
    const create = jest.fn().mockResolvedValue(transaction());
    const service = makeService(
      { create },
      category({ expiresAt: new Date('2027-01-01T00:00:00Z') }),
    );
    await expect(
      service.create(USER, {
        type: 'EXPENSE',
        status: 'CONFIRMED',
        amountCents: 100,
        description: 'x',
        date: NOW,
        categoryId: 'c'.repeat(24),
      }),
    ).resolves.toBeDefined();
  });
});

describe('TransactionsService — ciclo de vida do status (DOMAIN §3.2)', () => {
  const update = (current: Transaction, patch: Record<string, unknown>) => {
    const updateForUser = jest.fn().mockResolvedValue(transaction(patch));
    const service = makeService({
      findByIdForUser: jest.fn().mockResolvedValue(current),
      updateForUser,
    });
    return service.update(USER, OID, patch);
  };

  it('permite FORECAST→CONFIRMED, FORECAST→CANCELLED e CONFIRMED→CANCELLED', async () => {
    await expect(
      update(transaction({ status: 'FORECAST' }), { status: 'CONFIRMED' }),
    ).resolves.toBeDefined();
    await expect(
      update(transaction({ status: 'FORECAST' }), { status: 'CANCELLED' }),
    ).resolves.toBeDefined();
    await expect(
      update(transaction({ status: 'CONFIRMED' }), { status: 'CANCELLED' }),
    ).resolves.toBeDefined();
  });

  it('rejeita CONFIRMED→FORECAST (INVALID_STATUS_TRANSITION)', async () => {
    const error = await update(transaction({ status: 'CONFIRMED' }), { status: 'FORECAST' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect(((error as ConflictException).getResponse() as Record<string, unknown>).reason).toBe(
      'INVALID_STATUS_TRANSITION',
    );
  });

  it('CANCELLED é imutável (histórico de auditoria)', async () => {
    const error = await update(transaction({ status: 'CANCELLED' }), { description: 'x' }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ConflictException);
    expect(((error as ConflictException).getResponse() as Record<string, unknown>).reason).toBe(
      'TRANSACTION_CANCELLED',
    );
  });
});

describe('TransactionsService — soft delete', () => {
  it('usa o Clock e o userId como deletedBy', async () => {
    const softDeleteById = jest.fn().mockResolvedValue(transaction());
    const service = makeService({
      findByIdForUser: jest.fn().mockResolvedValue(transaction()),
      softDeleteById,
    });
    await service.softDelete(USER, OID);
    expect(softDeleteById).toHaveBeenCalledWith(OID, { deletedAt: NOW, deletedBy: USER });
  });
});
