import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { CategoriesModule } from '../categories/categories.module';
import { PlanningModule } from '../planning/planning.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { BudgetService } from './services/budget.service';
import { CategoryStatisticsService } from './services/category-statistics.service';
import { PacingService } from './services/pacing.service';
import { ProjectionService } from './services/projection.service';

@Module({
  imports: [DatabaseModule, TransactionsModule, PlanningModule, CategoriesModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    BudgetService,
    PacingService,
    ProjectionService,
    CategoryStatisticsService,
  ],
})
export class DashboardModule {}
