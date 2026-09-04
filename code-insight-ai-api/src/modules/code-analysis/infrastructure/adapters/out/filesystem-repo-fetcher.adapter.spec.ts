import { ConfigService } from '@nestjs/config';

const cloneMock = jest.fn();
const extractAllToMock = jest.fn();

jest.mock('simple-git', () => jest.fn(() => ({ clone: cloneMock })));
jest.mock('adm-zip', () =>
  jest.fn().mockImplementation(() => ({ extractAllTo: extractAllToMock })),
);
jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual('node:fs/promises');
  return {
    ...actual,
    mkdtemp: jest.fn(async (prefix: string) => `${prefix}xxxxxx`),
    rm: jest.fn(async () => undefined),
    writeFile: jest.fn(async () => undefined),
  };
});

import { FilesystemRepoFetcherAdapter } from './filesystem-repo-fetcher.adapter';
import { RepositorySourceType } from '../../../domain/entities/repository-source.entity';
import { rm, writeFile } from 'node:fs/promises';

describe('FilesystemRepoFetcherAdapter', () => {
  let adapter: FilesystemRepoFetcherAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'ZIP_UPLOADS_BUCKET' ? 'my-zip-bucket' : fallback,
      ),
    } as unknown as ConfigService;
    adapter = new FilesystemRepoFetcherAdapter(config);
  });

  describe('when fetching from a public git URL', () => {
    it('should shallow-clone it into a temp dir and return a "git" RepositorySource', async () => {
      // Given
      cloneMock.mockResolvedValue(undefined);

      // When
      const source = await adapter.fetchFromGit('https://github.com/owner/repo.git');

      // Then
      expect(cloneMock).toHaveBeenCalledWith(
        'https://github.com/owner/repo.git',
        expect.stringContaining('code-insight-git-'),
        ['--depth', '1'],
      );
      expect(source.type).toBe(RepositorySourceType.Git);
      expect(source.originalReference).toBe('https://github.com/owner/repo.git');
    });
  });

  describe('when fetching from a local ZIP file path', () => {
    it('should extract it into a temp dir and return a "zip" RepositorySource', async () => {
      // Given / When
      const source = await adapter.fetchFromZip('/tmp/uploaded.zip');

      // Then
      expect(extractAllToMock).toHaveBeenCalled();
      expect(source.type).toBe(RepositorySourceType.Zip);
      expect(source.originalReference).toBe('/tmp/uploaded.zip');
    });
  });

  describe('when fetching a ZIP uploaded to S3', () => {
    it('should download it, extract it, clean up the intermediate download dir, and use a readable display name', async () => {
      // Given
      const s3Send = jest.fn().mockResolvedValue({
        Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      });
      (adapter as unknown as { s3Client: { send: jest.Mock } }).s3Client = { send: s3Send };

      // When
      const source = await adapter.fetchFromS3Zip(
        'uploads/owner-1/uuid__my-project.zip',
      );

      // Then
      expect(s3Send).toHaveBeenCalledTimes(1);
      expect(writeFile).toHaveBeenCalled();
      expect(extractAllToMock).toHaveBeenCalled();
      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining('code-insight-s3zip-src-'),
        { recursive: true, force: true },
      );
      expect(source.type).toBe(RepositorySourceType.Zip);
      expect(source.originalReference).toBe('my-project.zip');
    });
  });

  describe('when cleaning up a source after use', () => {
    it('should recursively remove its local working directory', async () => {
      // Given
      const source = await adapter.fetchFromZip('/tmp/uploaded.zip');
      (rm as jest.Mock).mockClear();

      // When
      await adapter.cleanup(source);

      // Then
      expect(rm).toHaveBeenCalledWith(source.localPath, { recursive: true, force: true });
    });
  });
});
