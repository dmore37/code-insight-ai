import { PresignedUpload } from '../../ports/out/zip-upload.port';

export abstract class GetZipUploadUrlUseCase {
  abstract execute(ownerId?: string, fileName?: string): Promise<PresignedUpload>;
}
