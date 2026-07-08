import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { LoggingModule } from './common/logging/logging.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [ConfigModule, LoggingModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
