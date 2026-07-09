import type { BackupProviderType } from '@finances/shared';

export interface StoredBackup {
  location: string;
  providerType: BackupProviderType;
}

/**
 * Port do backup (ARCHITECTURE §5) — a única abstração port/adapter da V1,
 * porque tem duas implementações reais: Local (dev) e Object Storage (prod).
 * Backup automático NUNCA depende de filesystem efêmero.
 */
export interface BackupProvider {
  store(userId: string, filename: string, artifact: Buffer): Promise<StoredBackup>;
}

export const BACKUP_PROVIDER = Symbol('BACKUP_PROVIDER');
