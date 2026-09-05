import { S3ZipUploadAdapter } from './s3-zip-upload.adapter';
import { ConfigService } from '@nestjs/config';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
}));

describe('S3ZipUploadAdapter', () => {
  let adapter: S3ZipUploadAdapter;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'ZIP_UPLOADS_BUCKET' ? 'my-zip-bucket' : fallback,
      ),
    } as unknown as ConfigService;
    adapter = new S3ZipUploadAdapter(config);
  });

  describe('when generating an upload URL for an authenticated owner with a valid file name', () => {
    it('should build a key prefixed by the ownerId and keep a sanitized version of the file name', async () => {
            const result = await adapter.generateUploadUrl('owner-42', 'My Project.zip');

            expect(result.uploadUrl).toBe('https://s3.example.com/presigned-url');
      expect(result.key).toMatch(/^uploads\/owner-42\/[0-9a-f-]+__My_Project\.zip$/);
    });
  });

  describe('when generating an upload URL without an ownerId (anonymous)', () => {
    it('should use "anonymous" as the key prefix', async () => {
            const result = await adapter.generateUploadUrl(undefined, 'project.zip');

            expect(result.key).toMatch(/^uploads\/anonymous\/[0-9a-f-]+__project\.zip$/);
    });
  });

  describe('when no file name is provided', () => {
    it('should fall back to a plain ".zip" suffix instead of embedding "undefined"', async () => {
            const result = await adapter.generateUploadUrl('owner-42', undefined);

            expect(result.key).toMatch(/^uploads\/owner-42\/[0-9a-f-]+\.zip$/);
    });
  });

  describe('when the file name contains unsafe characters', () => {
    it('should replace every non-alphanumeric character (except . _ -) with an underscore', async () => {
            const result = await adapter.generateUploadUrl('owner-42', 'my project (final)!.zip');

            expect(result.key).toContain('my_project__final__.zip');
    });
  });
});
