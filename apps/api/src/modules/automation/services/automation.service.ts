import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  draftTransactionSchema,
  type Clock,
  type ConfirmDraftInput,
  type DraftTransaction,
  type IngestNotificationInput,
  type Transaction,
  type UpdateDraftInput,
} from '@finances/shared';
import type { Model } from 'mongoose';
import { CLOCK } from '../../../common/clock/clock.module';
import { BaseRepository } from '../../../common/database/base.repository';
import { MODELS } from '../../../common/database/schemas/collections';
import { TransactionsService } from '../../transactions/transactions.service';
import { ParserRegistry } from '../parsers/parser.registry';

const DUPLICATE_KEY = 11000;

/** Dono de draftTransactions: ingest + Inbox no MESMO módulo (gate review). */
@Injectable()
export class AutomationService extends BaseRepository<DraftTransaction> {
  constructor(
    @InjectModel(MODELS.DraftTransaction) model: Model<Record<string, unknown>>,
    private readonly parsers: ParserRegistry,
    private readonly transactionsService: TransactionsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(model, draftTransactionSchema);
  }

  /** Idempotente (ADR-006): reenvio do mesmo clientEventId devolve o draft existente. */
  async ingest(userId: string, input: IngestNotificationInput): Promise<DraftTransaction> {
    const { parsedData, confidence } = this.parsers.active.parse(input.rawNotification);
    try {
      return await this.create({
        userId,
        rawNotification: input.rawNotification,
        parsedData,
        confidence,
        status: 'PENDING',
        clientEventId: input.clientEventId,
        confirmedAt: null,
      });
    } catch (error) {
      if ((error as { code?: number }).code === DUPLICATE_KEY) {
        const existing = await this.model.findOne({
          userId,
          clientEventId: input.clientEventId,
        });
        if (existing !== null) return this.toDomain(existing);
      }
      throw error;
    }
  }

  async listPending(userId: string): Promise<DraftTransaction[]> {
    const docs = await this.model.find({ userId, status: 'PENDING' }).sort({ createdAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  /** Único caminho para a automação virar Transaction (Constitution #6). */
  async confirm(userId: string, draftId: string, input: ConfirmDraftInput): Promise<Transaction> {
    const draft = await this.getPendingDraft(userId, draftId);
    const parsedAmount = (draft.parsedData as { amountCents?: unknown }).amountCents;
    const amountCents =
      input.amountCents ?? (typeof parsedAmount === 'number' ? parsedAmount : undefined);
    if (amountCents === undefined) {
      throw new UnprocessableEntityException({
        message: 'Sem valor: informe amountCents (o parser não identificou e nunca inventa)',
        reason: 'AMOUNT_REQUIRED',
      });
    }
    const parsedDescription = (draft.parsedData as { description?: unknown }).description;
    const transaction = await this.transactionsService.create(
      userId,
      {
        type: 'EXPENSE',
        status: 'CONFIRMED',
        amountCents,
        description:
          input.description ??
          (typeof parsedDescription === 'string' ? parsedDescription : 'Notificação bancária'),
        date: input.date ?? draft.createdAt,
        categoryId: input.categoryId,
      },
      'AUTOMATION', // origem fiel (DATABASE §2.3)
    );
    await this.model.updateOne(
      { _id: draft.id, userId },
      { $set: { status: 'CONFIRMED', confirmedAt: this.clock.now() } },
    );
    return transaction;
  }

  async ignore(userId: string, draftId: string): Promise<DraftTransaction> {
    const draft = await this.getPendingDraft(userId, draftId);
    const doc = await this.model.findOneAndUpdate(
      { _id: draft.id, userId },
      { $set: { status: 'IGNORED' } },
      { returnDocument: 'after' },
    );
    if (doc === null) throw new NotFoundException('Draft não encontrado');
    return this.toDomain(doc);
  }

  async updateDraft(
    userId: string,
    draftId: string,
    input: UpdateDraftInput,
  ): Promise<DraftTransaction> {
    const draft = await this.getPendingDraft(userId, draftId);
    const set: Record<string, unknown> = {};
    if (input.amountCents !== undefined) set['parsedData.amountCents'] = input.amountCents;
    if (input.description !== undefined) set['parsedData.description'] = input.description;
    const doc = await this.model.findOneAndUpdate(
      { _id: draft.id, userId },
      { $set: set },
      { returnDocument: 'after' },
    );
    if (doc === null) throw new NotFoundException('Draft não encontrado');
    return this.toDomain(doc);
  }

  async deleteDraft(userId: string, draftId: string): Promise<void> {
    const draft = await this.findDraft(userId, draftId);
    await this.model.deleteOne({ _id: draft.id, userId });
  }

  private async findDraft(userId: string, draftId: string): Promise<DraftTransaction> {
    if (!this.isValidObjectId(draftId)) throw new NotFoundException('Draft não encontrado');
    const doc = await this.model.findOne({ _id: draftId, userId });
    if (doc === null) throw new NotFoundException('Draft não encontrado');
    return this.toDomain(doc);
  }

  private async getPendingDraft(userId: string, draftId: string): Promise<DraftTransaction> {
    const draft = await this.findDraft(userId, draftId);
    if (draft.status !== 'PENDING') {
      throw new ConflictException({
        message: `Draft já processado (${draft.status})`,
        reason: 'DRAFT_ALREADY_PROCESSED',
      });
    }
    return draft;
  }
}
