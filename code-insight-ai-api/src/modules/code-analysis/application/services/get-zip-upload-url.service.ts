import { Inject, Injectable } from '@nestjs/common';
import { GetZipUploadUrlUseCase } from '../ports/in/get-zip-upload-url.use-case';
import { ZipUploadPort, PresignedUpload } from '../ports/out/zip-upload.port';
import { ZIP_UPLOAD_PORT } from '../../infrastructure/config/tokens';

@Injectable()
export class GetZipUploadUrlService implements GetZipUploadUrlUseCase {
  constructor(
    @Inject(ZIP_UPLOAD_PORT) private readonly zipUpload: ZipUploadPort,
  ) {}

  async execute(ownerId?: string, fileName?: string): Promise<PresignedUpload> {
    return this.zipUpload.generateUploadUrl(ownerId, fileName);
  }
}
