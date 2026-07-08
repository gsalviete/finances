import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { userSchema, type User } from '@finances/shared';
import type { Model } from 'mongoose';
import { BaseRepository } from '../../../common/database/base.repository';
import { MODELS } from '../../../common/database/schemas/collections';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(@InjectModel(MODELS.User) model: Model<Record<string, unknown>>) {
    super(model, userSchema);
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.model.findOne({ email });
    return doc === null ? null : this.toDomain(doc);
  }

  async count(): Promise<number> {
    return this.model.countDocuments({});
  }
}
