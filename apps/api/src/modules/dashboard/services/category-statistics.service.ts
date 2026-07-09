import { Injectable } from '@nestjs/common';
import type { Transaction } from '@finances/shared';
import { CategoriesRepository } from '../../categories/repository/categories.repository';

export interface CategoryStatistic {
  categoryId: string;
  name: string;
  totalCents: number;
  percentage: number;
}

/** Categorias mais utilizadas por gasto CONFIRMADO do mês (FR-007). */
@Injectable()
export class CategoryStatisticsService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async compute(userId: string, monthTransactions: Transaction[]): Promise<CategoryStatistic[]> {
    const totals = new Map<string, number>();
    for (const t of monthTransactions) {
      if (t.type !== 'EXPENSE' || t.status !== 'CONFIRMED') continue;
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountCents);
    }
    if (totals.size === 0) return [];

    const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0);
    // inclui arquivadas/expiradas/deletadas: histórico precisa dos nomes
    const categories = await this.categoriesRepository.findMany({ userId }, { withDeleted: true });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return [...totals.entries()]
      .map(([categoryId, totalCents]) => ({
        categoryId,
        name: nameById.get(categoryId) ?? 'Categoria removida',
        totalCents,
        percentage: grandTotal > 0 ? (totalCents / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);
  }
}
