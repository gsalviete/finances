import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { Env } from '../../config/env.schema';
import { backupMongooseSchema } from './schemas/backup.mongoose';
import { categoryMongooseSchema } from './schemas/category.mongoose';
import { COLLECTIONS, MODELS } from './schemas/collections';
import { draftTransactionMongooseSchema } from './schemas/draft-transaction.mongoose';
import { monthlyPlanMongooseSchema } from './schemas/monthly-plan.mongoose';
import { recurringRuleMongooseSchema } from './schemas/recurring-rule.mongoose';
import { settingsMongooseSchema } from './schemas/settings.mongoose';
import { transactionMongooseSchema } from './schemas/transaction.mongoose';
import { userMongooseSchema } from './schemas/user.mongoose';
import { wishlistItemMongooseSchema } from './schemas/wishlist-item.mongoose';

/** Registro central: todas as coleções do DATABASE §2, nomes físicos exatos. */
export const MODEL_DEFINITIONS = [
  { name: MODELS.User, schema: userMongooseSchema, collection: COLLECTIONS.users },
  { name: MODELS.Category, schema: categoryMongooseSchema, collection: COLLECTIONS.categories },
  {
    name: MODELS.Transaction,
    schema: transactionMongooseSchema,
    collection: COLLECTIONS.transactions,
  },
  {
    name: MODELS.MonthlyPlan,
    schema: monthlyPlanMongooseSchema,
    collection: COLLECTIONS.monthlyPlans,
  },
  {
    name: MODELS.RecurringRule,
    schema: recurringRuleMongooseSchema,
    collection: COLLECTIONS.recurringRules,
  },
  {
    name: MODELS.DraftTransaction,
    schema: draftTransactionMongooseSchema,
    collection: COLLECTIONS.draftTransactions,
  },
  { name: MODELS.Settings, schema: settingsMongooseSchema, collection: COLLECTIONS.settings },
  { name: MODELS.Backup, schema: backupMongooseSchema, collection: COLLECTIONS.backups },
  {
    name: MODELS.WishlistItem,
    schema: wishlistItemMongooseSchema,
    collection: COLLECTIONS.wishlistItems,
  },
];

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
      }),
    }),
    MongooseModule.forFeature(MODEL_DEFINITIONS),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
