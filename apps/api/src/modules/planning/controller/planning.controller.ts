import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ensureMonthlyPlanInputSchema,
  getMonthlyPlanQuerySchema,
  monthlyPlanSchema,
  updateMonthlyPlanInputSchema,
  type EnsureMonthlyPlanInput,
  type GetMonthlyPlanQuery,
  type MonthlyPlan,
  type UpdateMonthlyPlanInput,
} from '@finances/shared';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { PlanningService } from '../services/planning.service';

@ApiTags('planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get()
  @ApiOperation({ summary: 'Plano do mês (corrente por padrão; dispara virada lazy)' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(monthlyPlanSchema, 'output') })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(getMonthlyPlanQuerySchema)) query: GetMonthlyPlanQuery,
  ): Promise<MonthlyPlan> {
    return this.planningService.getPlan(user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Força a criação do snapshot de um mês (idempotente)' })
  @ApiBody({ schema: zodToOpenApiSchema(ensureMonthlyPlanInputSchema) })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(monthlyPlanSchema, 'output') })
  ensure(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ensureMonthlyPlanInputSchema)) input: EnsureMonthlyPlanInput,
  ): Promise<MonthlyPlan> {
    return this.planningService.ensure(user.userId, input);
  }

  @Put()
  @ApiOperation({ summary: 'Edita itens/notas do snapshot (FR-008); itens PAID são imutáveis' })
  @ApiBody({ schema: zodToOpenApiSchema(updateMonthlyPlanInputSchema) })
  @ApiOkResponse({ schema: zodToOpenApiSchema(monthlyPlanSchema, 'output') })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateMonthlyPlanInputSchema)) input: UpdateMonthlyPlanInput,
  ): Promise<MonthlyPlan> {
    return this.planningService.updatePlan(user.userId, input);
  }
}
