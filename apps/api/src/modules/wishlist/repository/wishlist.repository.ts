import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { wishlistItemSchema, type WishlistItem } from '@finances/shared';
import type { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database/base.repository';
import { MODELS } from '../../../common/database/schemas/collections';

@Injectable()
export class WishlistRepository extends BaseRepository<WishlistItem> {
  constructor(@InjectModel(MODELS.WishlistItem) model: Model<Record<string, unknown>>) {
    super(model, wishlistItemSchema);
  }

  /** Mais recentes primeiro; ordenação por prioridade é do serviço (cardinalidade baixa). */
  async listForUser(userId: string): Promise<WishlistItem[]> {
    const docs = await this.model.find({ userId }).sort({ createdAt: -1 });
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByIdForUser(id: string, userId: string): Promise<WishlistItem | null> {
    if (!this.isValidObjectId(id)) return null;
    const doc = await this.model.findOne({ _id: id, userId });
    return doc === null ? null : this.toDomain(doc);
  }

  async updateForUser(
    id: string,
    userId: string,
    update: Record<string, unknown>,
  ): Promise<WishlistItem | null> {
    if (!this.isValidObjectId(id)) return null;
    const doc = await this.model.findOneAndUpdate(
      { _id: id, userId },
      { $set: update },
      { returnDocument: 'after', runValidators: true },
    );
    return doc === null ? null : this.toDomain(doc);
  }
}
