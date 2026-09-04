import { PresignedUpload } from '../../ports/out/zip-upload.port';

/**
 * Puerto de entrada: solicita una URL prefirmada para subir un ZIP a S3.
 */
export abstract class GetZipUploadUrlUseCase {
  abstract execute(ownerId?: string, fileName?: string): Promise<PresignedUpload>;
}
