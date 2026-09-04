import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ZipUploadPort, PresignedUpload } from '../../../domain/ports/out/zip-upload.port';
import { UPLOAD_URL_TTL_SECONDS } from '../../../domain/config/business-rules.constants';
import { DEFAULT_AWS_REGION } from '../../config/defaults';

/**
 * Adaptador de salida: genera URLs prefirmadas de S3 (PUT) para que el
 * navegador suba un ZIP directamente al bucket de uploads, evitando pasar
 * el archivo por Lambda/API Gateway (límite de payload de 10MB).
 *
 * La key generada incluye el `ownerId` (o "anonymous") como prefijo, de
 * forma que en el futuro se pueda restringir/organizar por usuario.
 */
@Injectable()
export class S3ZipUploadAdapter implements ZipUploadPort {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.s3Client = new S3Client({
      region: this.config.get<string>('AWS_REGION', DEFAULT_AWS_REGION),
    });
    this.bucket = this.config.get<string>('ZIP_UPLOADS_BUCKET', '');
  }

  async generateUploadUrl(
    ownerId?: string,
    fileName?: string,
  ): Promise<PresignedUpload> {
    const prefix = ownerId ?? 'anonymous';
    const safeName = this.sanitizeFileName(fileName);
    const key = safeName
      ? `uploads/${prefix}/${randomUUID()}__${safeName}`
      : `uploads/${prefix}/${randomUUID()}.zip`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: 'application/zip',
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });

    return { uploadUrl, key };
  }

  /**
   * Sanitiza el nombre de archivo original para usarlo como sufijo del key
   * de S3: solo alfanuméricos, punto, guion y guion_bajo; se acota la
   * longitud para evitar keys extremadamente largos.
   */
  private sanitizeFileName(fileName?: string): string | undefined {
    if (!fileName) return undefined;
    const cleaned = fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(-100);
    return cleaned.length > 0 ? cleaned : undefined;
  }
}
