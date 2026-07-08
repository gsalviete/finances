import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringRulesController } from './controller/recurring-rules.controller';
import { RecurringRulesRepository } from './repository/recurring-rules.repository';
import { RecurringRulesService } from './services/recurring-rules.service';

/**
 * Planning — dono das recurringRules e (Fase 14) dos monthlyPlans + virada de mês.
 * TransactionsModule é importado pela validação de categoria e, na Fase 14,
 * pela materialização de FORECAST na virada.
 */
@Module({
  imports: [DatabaseModule, TransactionsModule],
  controllers: [RecurringRulesController],
  providers: [RecurringRulesService, RecurringRulesRepository],
  exports: [RecurringRulesRepository],
})
export class PlanningModule {}
