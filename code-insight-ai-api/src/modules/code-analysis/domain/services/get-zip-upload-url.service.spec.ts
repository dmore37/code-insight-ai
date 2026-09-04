import { GetZipUploadUrlService } from './get-zip-upload-url.service';
import { ZipUploadPort } from '../ports/out/zip-upload.port';

describe('GetZipUploadUrlService', () => {
  let zipUpload: jest.Mocked<ZipUploadPort>;
  let service: GetZipUploadUrlService;

  beforeEach(() => {
    zipUpload = { generateUploadUrl: jest.fn() };
    service = new GetZipUploadUrlService(zipUpload);
  });

  describe('given an ownerId and a fileName', () => {
    it('should delegate to the ZipUploadPort with both arguments and return its result', async () => {
      // Given
      zipUpload.generateUploadUrl.mockResolvedValue({
        uploadUrl: 'https://s3.example.com/presigned',
        key: 'uploads/owner-1/uuid__file.zip',
      });

      // When
      const result = await service.execute('owner-1', 'file.zip');

      // Then
      expect(zipUpload.generateUploadUrl).toHaveBeenCalledWith('owner-1', 'file.zip');
      expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    });
  });
});
