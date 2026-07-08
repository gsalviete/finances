import { ConflictException, NotFoundException } from '@nestjs/common';
import { fixedClock, type Category } from '@finances/shared';
import { CategoriesService } from '../src/modules/categories/categories.service';
import type { CategoriesRepository } from '../src/modules/categories/repository/categories.repository';

const USER = 'b'.repeat(24);
const NOW = new Date('2026-07-08T15:00:00.000Z');

const category = (overrides: Partial<Category> = {}): Category => ({
  id: 'a'.repeat(24),
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

type RepoStub = {
  [K in keyof CategoriesRepository]?: jest.Mock;
};

const makeService = (repo: RepoStub) =>
  new CategoriesService(repo as unknown as CategoriesRepository, fixedClock(NOW));

describe('CategoriesService', () => {
  it('create sem sortOrder entra no fim da fila (ADR-016)', async () => {
    const create = jest.fn().mockResolvedValue(category({ sortOrder: 7 }));
    const service = makeService({ nextSortOrder: jest.fn().mockResolvedValue(7), create });

    await service.create(USER, { name: 'Novo', icon: 'tag', color: 'category.blue' });

    const persisted = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(persisted.sortOrder).toBe(7);
    expect(persisted.active).toBe(true);
    expect(persisted.archived).toBe(false);
    expect(persisted.expiresAt).toBeNull();
  });

  it('create com sortOrder explícito não consulta a fila', async () => {
    const nextSortOrder = jest.fn();
    const create = jest.fn().mockResolvedValue(category({ sortOrder: 2 }));
    const service = makeService({ nextSortOrder, create });
    await service.create(USER, { name: 'X', icon: 'tag', color: 'c', sortOrder: 2 });
    expect(nextSortOrder).not.toHaveBeenCalled();
  });

  it('list injeta o "agora" do Clock no filtro de expiração', async () => {
    const listForUser = jest.fn().mockResolvedValue([]);
    const service = makeService({ listForUser });
    await service.list(USER, { includeArchived: false, includeExpired: false });
    expect(listForUser).toHaveBeenCalledWith(USER, {
      includeArchived: false,
      includeExpired: false,
      now: NOW,
    });
  });

  it('get/update de categoria inexistente ou de outro usuário → 404', async () => {
    const service = makeService({
      findByIdForUser: jest.fn().mockResolvedValue(null),
      updateForUser: jest.fn().mockResolvedValue(null),
    });
    await expect(service.get(USER, 'a'.repeat(24))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(USER, 'a'.repeat(24), { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('softDelete bloqueia categoria em uso com CATEGORY_IN_USE (ADR-016)', async () => {
    const service = makeService({
      findByIdForUser: jest.fn().mockResolvedValue(category()),
      countTransactionsUsing: jest.fn().mockResolvedValue(3),
      softDeleteById: jest.fn(),
    });
    const error = await service.softDelete(USER, 'a'.repeat(24)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    const body = (error as ConflictException).getResponse() as Record<string, unknown>;
    expect(body.reason).toBe('CATEGORY_IN_USE');
  });

  it('softDelete de categoria sem uso usa o Clock e o userId como deletedBy', async () => {
    const softDeleteById = jest.fn().mockResolvedValue(category({ deletedAt: NOW }));
    const service = makeService({
      findByIdForUser: jest.fn().mockResolvedValue(category()),
      countTransactionsUsing: jest.fn().mockResolvedValue(0),
      softDeleteById,
    });
    await service.softDelete(USER, 'a'.repeat(24));
    expect(softDeleteById).toHaveBeenCalledWith('a'.repeat(24), {
      deletedAt: NOW,
      deletedBy: USER,
    });
  });
});
