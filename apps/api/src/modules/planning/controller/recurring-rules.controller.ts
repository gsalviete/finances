import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
  createRecurringRuleInputSchema,
  recurringRuleSchema,
  updateRecurringRuleInputSchema,
  type CreateRecurringRuleInput,
  type RecurringRule,
  type UpdateRecurringRuleInput,
} from '@finances/shared';
import { z } from 'zod';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { RecurringRulesService } from '../services/recurring-rules.service';

const listQuerySchema = z.object({ onlyActive: z.stringbool().default(false) });
type ListQuery = z.infer<typeof listQuerySchema>;

@ApiTags('recurring-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recurring-rules')
export class RecurringRulesController {
  constructor(private readonly rulesService: RecurringRulesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria recorrência (template; apenas MONTHLY na V1)' })
  @ApiBody({ schema: zodToOpenApiSchema(createRecurringRuleInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(recurringRuleSchema, 'output') })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRecurringRuleInputSchema)) input: CreateRecurringRuleInput,
  ): Promise<RecurringRule> {
    return this.rulesService.create(user.userId, input);
  }

  @Get()
  @ApiOperation({ summary: 'Lista recorrências (ordena por dayOfMonth, description)' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(z.array(recurringRuleSchema), 'output') })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listQuerySchema)) query: ListQuery,
  ): Promise<RecurringRule[]> {
    return this.rulesService.list(user.userId, query.onlyActive);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma recorrência' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(recurringRuleSchema, 'output') })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<RecurringRule> {
    return this.rulesService.get(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita o template — NUNCA altera meses passados (DOMAIN §3.5)' })
  @ApiBody({ schema: zodToOpenApiSchema(updateRecurringRuleInputSchema) })
  @ApiOkResponse({ schema: zodToOpenApiSchema(recurringRuleSchema, 'output') })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRecurringRuleInputSchema)) input: UpdateRecurringRuleInput,
  ): Promise<RecurringRule> {
    return this.rulesService.update(user.userId, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete da recorrência (ADR-010)' })
  @ApiNoContentResponse({ description: 'Recorrência soft-deletada' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.rulesService.softDelete(user.userId, id);
  }
}
