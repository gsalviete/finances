import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  dashboardQuerySchema,
  dashboardResponseSchema,
  type DashboardQuery,
  type DashboardResponse,
} from '@finances/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Todos os KPIs prontos (3 lentes, ritmo, projeção, categorias)' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(dashboardResponseSchema, 'output') })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(dashboardQuerySchema)) query: DashboardQuery,
  ): Promise<DashboardResponse> {
    return this.dashboardService.get(user.userId, query);
  }
}
