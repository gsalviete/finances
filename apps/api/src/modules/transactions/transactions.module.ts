import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { CategoriesModule } from '../categories/categories.module';
import { TransactionsRepository } from './repository/transactions.repository';
import { InstallmentService } from './services/installment.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [DatabaseModule, CategoriesModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, InstallmentService, TransactionsRepository],
  exports: [TransactionsRepository, TransactionsService],
})
export class TransactionsModule {}
