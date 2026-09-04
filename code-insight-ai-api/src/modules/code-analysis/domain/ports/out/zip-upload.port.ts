export interface PresignedUpload {

  uploadUrl: string;

  key: string;
}

export abstract class ZipUploadPort {

  abstract generateUploadUrl(
    ownerId?: string,
    fileName?: string,
  ): Promise<PresignedUpload>;
}
