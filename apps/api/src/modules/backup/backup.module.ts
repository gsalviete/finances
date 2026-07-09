import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../common/database/database.module';
import type { Env } from '../../config/env.schema';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { BACKUP_PROVIDER } from './providers/backup-provider.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { ObjectStorageProvider } from './providers/object-storage.provider';
import { ExportService } from './services/export.service';
import { ImportService } from './services/import.service';

/** Seleção do adapter por AMBIENTE (DATABASE §2.7): dev=Local, prod=Object Storage. */
@Module({
  imports: [DatabaseModule],
  controllers: [BackupController],
  providers: [
    ExportService,
    ImportService,
    BackupService,
    {
      provide: BACKUP_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        if (config.get('BACKUP_PROVIDER', { infer: true }) === 'OBJECT_STORAGE') {
          return new ObjectStorageProvider({
            endpoint: config.get('OBJECT_STORAGE_ENDPOINT', { infer: true }) as string,
            region: config.get('OBJECT_STORAGE_REGION', { infer: true }) as string,
            bucket: config.get('OBJECT_STORAGE_BUCKET', { infer: true }) as string,
            accessKeyId: config.get('OBJECT_STORAGE_ACCESS_KEY', { infer: true }) as string,
            secretAccessKey: config.get('OBJECT_STORAGE_SECRET_KEY', { infer: true }) as string,
          });
        }
        return new LocalStorageProvider(config.get('BACKUP_LOCAL_DIR', { infer: true }));
      },
    },
  ],
})
export class BackupModule {}
