import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  settingsSchema,
  updateSettingsInputSchema,
  type Settings,
  type UpdateSettingsInput,
} from '@finances/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../common/openapi/zod-openapi';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Preferências do usuário (cria defaults se necessário)' })
  @ApiOkResponse({ schema: zodToOpenApiSchema(settingsSchema, 'output') })
  get(@CurrentUser() user: AuthenticatedUser): Promise<Settings> {
    return this.settingsService.getOrCreate(user.userId);
  }

  @Put()
  @ApiOperation({
    summary: 'Atualiza preferências (tema, moeda, idioma, timezone, backup, motion)',
  })
  @ApiBody({ schema: zodToOpenApiSchema(updateSettingsInputSchema) })
  @ApiOkResponse({ schema: zodToOpenApiSchema(settingsSchema, 'output') })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateSettingsInputSchema)) input: UpdateSettingsInput,
  ): Promise<Settings> {
    return this.settingsService.update(user.userId, input);
  }
}
