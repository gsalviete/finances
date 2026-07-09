import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  Category,
  Clock,
  CreateTransactionInput,
  ListTransactionsQuery,
  Transaction,
  TransactionStatus,
  UpdateTransactionInput,
} from '@finances/shared';
import { CLOCK } from '../../common/clock/clock.module';
import { CategoriesRepository } from '../categories/repository/categories.repository';
import { decodeCursor, encodeCursor } from './cursor';
import { TransactionsRepository } from './repository/transactions.repository';

export interface TransactionPageResponse {
  items: Transaction[];
  nextCursor: string | null;
}

/** Transições permitidas pelo ciclo de vida (DOMAIN §3.2). CANCELLED é terminal. */
const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  FORECAST: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  CANCELLED: [],
};

@Injectable()
export class TransactionsService {
  constructor(
    private readonly repository: TransactionsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(
    userId: string,
    input: CreateTransactionInput,
    origin: 'MANUAL' | 'AUTOMATION' | 'IMPORT' = 'MANUAL',
  ): Promise<Transaction> {
    await this.assertUsableCategory(userId, input.categoryId);
    return this.repository.create({
      userId,
      categoryId: input.categoryId,
      type: input.type,
      status: input.status,
      amountCents: input.amountCents,
      description: input.description,
      date: input.date,
      origin,
    });
  }

  async list(userId: string, query: ListTransactionsQuery): Promise<TransactionPageResponse> {
    const page = await this.repository.listPage(userId, {
      limit: query.limit,
      year: query.year,
      month: query.month,
      type: query.type,
      status: query.status,
      categoryId: query.categoryId,
      cursor: query.cursor ? decodeCursor(query.cursor) : undefined,
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    };
  }

  async get(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.repository.findByIdForUser(id, userId);
    if (transaction === null) {
      throw new NotFoundException('Transação não encontrada');
    }
    return transaction;
  }

  async update(userId: string, id: string, input: UpdateTransactionInput): Promise<Transaction> {
    const current = await this.get(userId, id);
    if (current.status === 'CANCELLED') {
      throw new ConflictException({
        message: 'Transação cancelada é imutável (permanece apenas como histórico)',
        reason: 'TRANSACTION_CANCELLED',
      });
    }
    if (input.status !== undefined && input.status !== current.status) {
      if (!ALLOWED_TRANSITIONS[current.status].includes(input.status)) {
        throw new ConflictException({
          message: `Transição de status inválida: ${current.status} → ${input.status}`,
          reason: 'INVALID_STATUS_TRANSITION',
        });
      }
    }
    if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
      await this.assertUsableCategory(userId, input.categoryId);
    }
    const updated = await this.repository.updateForUser(id, userId, input);
    if (updated === null) {
      throw new NotFoundException('Transação não encontrada');
    }
    return updated;
  }

  /** Verificação lazy da auto-confirmação (DOMAIN §6.3) — disparada nas leituras. */
  async autoConfirmDue(userId: string): Promise<number> {
    return this.repository.confirmDue(userId, this.clock.now());
  }

  async softDelete(userId: string, id: string): Promise<void> {
    const transaction = await this.get(userId, id);
    await this.repository.softDeleteById(transaction.id, {
      deletedAt: this.clock.now(),
      deletedBy: userId,
    });
  }

  /** FR-015 (categoria obrigatória e válida) + ADR-016 (expirada não recebe novas). */
  async assertUsableCategory(userId: string, categoryId: string): Promise<Category> {
    const category = await this.categoriesRepository.findByIdForUser(categoryId, userId);
    if (category === null) {
      throw new UnprocessableEntityException({
        message: 'Categoria não encontrada para este usuário',
        reason: 'CATEGORY_NOT_FOUND',
      });
    }
    if (category.expiresAt !== null && category.expiresAt <= this.clock.now()) {
      throw new UnprocessableEntityException({
        message: 'Categoria expirada não pode receber novas transações (ADR-016)',
        reason: 'CATEGORY_EXPIRED',
      });
    }
    return category;
  }
}
