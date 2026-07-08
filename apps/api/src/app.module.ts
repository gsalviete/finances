import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { DatabaseModule } from './common/database/database.module';
import { LoggingModule } from './common/logging/logging.module';
import { ConfigModule } from './config/config.module';
import { ClockModule } from './common/clock/clock.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HealthModule } from './modules/health/health.module';
import { PlanningModule } from './modules/planning/planning.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    ClockModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    TransactionsModule,
    PlanningModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
