import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { BackupProvider, StoredBackup } from './backup-provider.interface';

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Adapter de PRODUÇÃO: S3/GCS-compatível — sobrevive a ambientes efêmeros. */
@Injectable()
export class ObjectStorageProvider implements BackupProvider {
  private readonly client: S3Client;

  constructor(private readonly config: ObjectStorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // compatibilidade com MinIO/GCS interop
    });
  }

  async store(userId: string, filename: string, artifact: Buffer): Promise<StoredBackup> {
    const key = `${userId}/${filename}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: artifact,
        ContentType: 'application/zip',
      }),
    );
    return { location: `s3://${this.config.bucket}/${key}`, providerType: 'OBJECT_STORAGE' };
  }
}
