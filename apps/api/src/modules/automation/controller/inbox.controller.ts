import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  confirmDraftInputSchema,
  draftTransactionSchema,
  transactionSchema,
  updateDraftInputSchema,
  type ConfirmDraftInput,
  type DraftTransaction,
  type Transaction,
  type UpdateDraftInput,
} from '@finances/shared';
import { z } from 'zod';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { AutomationService } from '../services/automation.service';

/** "Inbox" é nome de UI: as rotas vivem no módulo Automation (gate review). */
@ApiTags('inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(private readonly automationService: AutomationService) {}

  @Get()
  @ApiOperation({ summary: 'Drafts pendentes de revisão' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(z.array(draftTransactionSchema), 'output') })
  list(@CurrentUser() user: AuthenticatedUser): Promise<DraftTransaction[]> {
    return this.automationService.listPending(user.userId);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirma o draft → cria a Transaction (origin AUTOMATION)' })
  @ApiBody({ schema: zodToOpenApiSchema(confirmDraftInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(transactionSchema, 'output') })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmDraftInputSchema)) input: ConfirmDraftInput,
  ): Promise<Transaction> {
    return this.automationService.confirm(user.userId, id, input);
  }

  @Post(':id/ignore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Ignora o draft (permanece no histórico da Inbox)' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(draftTransactionSchema, 'output') })
  ignore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DraftTransaction> {
    return this.automationService.ignore(user.userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edita a sugestão do parser antes de confirmar' })
  @ApiBody({ schema: zodToOpenApiSchema(updateDraftInputSchema) })
  @ApiOkResponse({ schema: zodToOpenApiSchema(draftTransactionSchema, 'output') })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateDraftInputSchema)) input: UpdateDraftInput,
  ): Promise<DraftTransaction> {
    return this.automationService.updateDraft(user.userId, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Descarta o draft' })
  @ApiNoContentResponse({ description: 'Draft removido' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.automationService.deleteDraft(user.userId, id);
  }
}
