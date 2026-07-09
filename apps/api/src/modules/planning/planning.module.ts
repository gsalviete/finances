import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { PlanningController } from './controller/planning.controller';
import { RecurringRulesController } from './controller/recurring-rules.controller';
import { MonthlyPlansRepository } from './repository/monthly-plans.repository';
import { RecurringRulesRepository } from './repository/recurring-rules.repository';
import { MonthRolloverService } from './services/month-rollover.service';
import { PlanningService } from './services/planning.service';
import { RecurringRulesService } from './services/recurring-rules.service';

/** Planning — dono das recurringRules, dos monthlyPlans e da virada de mês (§6.2). */
@Module({
  imports: [DatabaseModule, TransactionsModule],
  controllers: [RecurringRulesController, PlanningController],
  providers: [
    RecurringRulesService,
    RecurringRulesRepository,
    MonthlyPlansRepository,
    MonthRolloverService,
    PlanningService,
  ],
  exports: [
    RecurringRulesRepository,
    MonthlyPlansRepository,
    MonthRolloverService,
    PlanningService,
  ],
})
export class PlanningModule {}
