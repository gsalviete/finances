import {
  categorySchema,
  createCategoryInputSchema,
  listCategoriesQuerySchema,
  updateCategoryInputSchema,
} from '../src';

describe('categorySchema — extensões do ADR-016', () => {
  const base = {
    id: 'a'.repeat(24),
    userId: 'b'.repeat(24),
    name: 'Mercado',
    icon: 'shopping-cart',
    color: 'category.green',
    active: true,
    archived: false,
    sortOrder: 3,
    expiresAt: null,
    deletedAt: null,
    deletedBy: null,
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-01T12:00:00.000Z',
  };

  it('aceita sortOrder >= 0 e expiresAt nulo ou data', () => {
    expect(categorySchema.parse(base).sortOrder).toBe(3);
    expect(
      categorySchema.parse({ ...base, expiresAt: '2026-12-31T23:59:59.000Z' }).expiresAt,
    ).toBeInstanceOf(Date);
  });

  it('rejeita sortOrder negativo ou fracionário', () => {
    expect(categorySchema.safeParse({ ...base, sortOrder: -1 }).success).toBe(false);
    expect(categorySchema.safeParse({ ...base, sortOrder: 1.5 }).success).toBe(false);
  });
});

describe('contratos de entrada de categorias', () => {
  it('create aceita somente name/icon/color (+ sortOrder/expiresAt opcionais)', () => {
    const minimal = createCategoryInputSchema.parse({
      name: 'Lazer',
      icon: 'gamepad-2',
      color: 'category.purple',
    });
    expect(minimal).not.toHaveProperty('archived');
    const full = createCategoryInputSchema.parse({
      name: 'Festa',
      icon: 'party-popper',
      color: 'category.pink',
      sortOrder: 10,
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    expect(full.sortOrder).toBe(10);
  });

  it('create rejeita nome vazio', () => {
    expect(createCategoryInputSchema.safeParse({ name: ' ', icon: 'x', color: 'y' }).success).toBe(
      false,
    );
  });

  it('update parcial exige ao menos um campo', () => {
    expect(updateCategoryInputSchema.safeParse({}).success).toBe(false);
    expect(updateCategoryInputSchema.parse({ archived: true })).toEqual({ archived: true });
    expect(updateCategoryInputSchema.parse({ expiresAt: null })).toEqual({ expiresAt: null });
  });

  it('query de listagem: defaults false; aceita "true"/"false" de querystring', () => {
    expect(listCategoriesQuerySchema.parse({})).toEqual({
      includeArchived: false,
      includeExpired: false,
    });
    expect(listCategoriesQuerySchema.parse({ includeArchived: 'true' }).includeArchived).toBe(true);
    expect(listCategoriesQuerySchema.safeParse({ includeExpired: 'talvez' }).success).toBe(false);
  });
});
