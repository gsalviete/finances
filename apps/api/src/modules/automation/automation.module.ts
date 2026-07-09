import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AutomationController } from './controller/automation.controller';
import { InboxController } from './controller/inbox.controller';
import { GenericParser } from './parsers/generic.parser';
import { ParserRegistry } from './parsers/parser.registry';
import { AutomationService } from './services/automation.service';

/** Automation — módulo ÚNICO dono de draftTransactions: ingest + Inbox (ADR-007/008). */
@Module({
  imports: [DatabaseModule, TransactionsModule],
  controllers: [AutomationController, InboxController],
  providers: [AutomationService, GenericParser, ParserRegistry],
})
export class AutomationModule {}
