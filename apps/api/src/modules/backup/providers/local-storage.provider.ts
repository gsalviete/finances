import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { BackupProvider, StoredBackup } from './backup-provider.interface';

/** Adapter de DESENVOLVIMENTO: grava no diretório configurado (BACKUP_LOCAL_DIR). */
@Injectable()
export class LocalStorageProvider implements BackupProvider {
  constructor(private readonly baseDir: string) {}

  async store(userId: string, filename: string, artifact: Buffer): Promise<StoredBackup> {
    const dir = resolve(this.baseDir, userId);
    await mkdir(dir, { recursive: true });
    const path = join(dir, filename);
    await writeFile(path, artifact);
    return { location: path, providerType: 'LOCAL' };
  }
}
