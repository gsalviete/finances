import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { backupMetadataSchema, type BackupMetadata, type Clock } from '@finances/shared';
import type { Model } from 'mongoose';
import { CLOCK } from '../../common/clock/clock.module';
import { BaseRepository } from '../../common/database/base.repository';
import { MODELS } from '../../common/database/schemas/collections';
import { BACKUP_PROVIDER, type BackupProvider } from './providers/backup-provider.interface';
import { ExportService } from './services/export.service';

/** Backup via provider (nunca filesystem efêmero) + registro de metadados (DATABASE §2.8). */
@Injectable()
export class BackupService extends BaseRepository<BackupMetadata> {
  constructor(
    @InjectModel(MODELS.Backup) model: Model<Record<string, unknown>>,
    private readonly exportService: ExportService,
    @Inject(BACKUP_PROVIDER) private readonly provider: BackupProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(model, backupMetadataSchema);
  }

  async runBackup(userId: string): Promise<BackupMetadata> {
    const now = this.clock.now();
    const artifact = await this.exportService.buildArtifact(userId, now);
    const filename = `finances-backup-${now.toISOString().replace(/[:.]/g, '-')}.zip`;
    const stored = await this.provider.store(userId, filename, artifact.buffer);
    return this.create({
      userId,
      location: stored.location,
      providerType: stored.providerType,
      sizeBytes: artifact.buffer.byteLength,
      checksum: artifact.checksum,
    });
  }
}
