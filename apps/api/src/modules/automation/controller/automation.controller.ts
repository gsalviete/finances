import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  draftTransactionSchema,
  ingestNotificationInputSchema,
  type DraftTransaction,
  type IngestNotificationInput,
} from '@finances/shared';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { AutomationService } from '../services/automation.service';

@ApiTags('automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('notification')
  @ApiOperation({
    summary: 'Ingestão do Apple Shortcut — idempotente por clientEventId (ADR-006)',
  })
  @ApiBody({ schema: zodToOpenApiSchema(ingestNotificationInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(draftTransactionSchema, 'output') })
  ingest(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ingestNotificationInputSchema)) input: IngestNotificationInput,
  ): Promise<DraftTransaction> {
    return this.automationService.ingest(user.userId, input);
  }
}
