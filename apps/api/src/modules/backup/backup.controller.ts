import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { backupMetadataSchema, type BackupMetadata, type Clock } from '@finances/shared';
import { CLOCK } from '../../common/clock/clock.module';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/jwt-payload.schema';
import { zodToOpenApiSchema } from '../../common/openapi/zod-openapi';
import { BackupService } from './backup.service';
import { ExportService } from './services/export.service';
import { ImportService, type ImportSummary } from './services/import.service';

@ApiTags('backup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('backup')
export class BackupController {
  constructor(
    private readonly exportService: ExportService,
    private readonly importService: ImportService,
    private readonly backupService: BackupService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get('export')
  @Header('Content-Type', 'application/zip')
  @ApiOperation({ summary: 'Export manual: download direto do ZIP (FR-031, sem dados sensíveis)' })
  async export(@CurrentUser() user: AuthenticatedUser): Promise<StreamableFile> {
    const now = this.clock.now();
    const artifact = await this.exportService.buildArtifact(user.userId, now);
    const stamp = now.toISOString().slice(0, 10);
    return new StreamableFile(artifact.buffer, {
      disposition: `attachment; filename="finances-export-${stamp}.zip"`,
    });
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import com estratégia explícita (REPLACE) — falha atomicamente' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'strategy'],
      properties: {
        file: { type: 'string', format: 'binary' },
        strategy: { type: 'string', enum: ['REPLACE'] },
      },
    },
  })
  async import(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('strategy') strategy: string | undefined,
  ): Promise<ImportSummary> {
    if (strategy !== 'REPLACE') {
      throw new BadRequestException({
        message: 'Estratégia de conflito deve ser explícita: strategy=REPLACE (FR-032)',
        reason: 'STRATEGY_REQUIRED',
      });
    }
    if (!file) {
      throw new BadRequestException({ message: 'Arquivo ZIP ausente (campo "file")' });
    }
    return this.importService.replaceFromZip(user.userId, file.buffer);
  }

  @Post('run')
  @ApiOperation({ summary: 'Executa backup via BackupProvider e registra metadados' })
  @ApiCreatedResponse({ schema: zodToOpenApiSchema(backupMetadataSchema, 'output') })
  run(@CurrentUser() user: AuthenticatedUser): Promise<BackupMetadata> {
    return this.backupService.runBackup(user.userId);
  }
}
