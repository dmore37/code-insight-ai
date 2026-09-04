import { SubmitAnalysisService } from './submit-analysis.service';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisQueuePort } from '../ports/out/analysis-queue.port';
import { AnalysisRecord, AnalysisStatus, AnalysisVisibility } from '../entities/analysis-record.entity';
import { MissingRepositorySourceError, AnalysisQueueError } from '../errors/code-analysis.errors';

describe('SubmitAnalysisService', () => {
  let analysisRepository: jest.Mocked<AnalysisRepositoryPort>;
  let analysisQueue: jest.Mocked<AnalysisQueuePort>;
  let service: SubmitAnalysisService;

  beforeEach(() => {
    analysisRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findRecent: jest.fn(),
      findLatestCompletedByGitUrl: jest.fn(),
      findLatestCompletedByZipHash: jest.fn(),
      findRecentPublicAndByOwner: jest.fn(),
    };
    analysisQueue = { enqueue: jest.fn() };

    service = new SubmitAnalysisService(analysisRepository, analysisQueue);
  });

  describe('when the command has no repository source at all', () => {
    it('should throw MissingRepositorySourceError without saving or enqueuing anything', async () => {
      // Given: an empty command
      const command = {};

      // When / Then
      await expect(service.execute(command)).rejects.toBeInstanceOf(
        MissingRepositorySourceError,
      );
      expect(analysisRepository.save).not.toHaveBeenCalled();
      expect(analysisQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('when submitting a new gitUrl analysis with no cached result', () => {
    it('should create a "processing" record, persist it and enqueue the job', async () => {
      // Given: no previous completed analysis exists for this gitUrl
      analysisRepository.findLatestCompletedByGitUrl.mockResolvedValue(null);

      // When
      const record = await service.execute({
        gitUrl: 'https://github.com/owner/repo.git',
      });

      // Then
      expect(record.status).toBe(AnalysisStatus.Processing);
      expect(record.visibility).toBe(AnalysisVisibility.Public);
      expect(analysisRepository.save).toHaveBeenCalledWith(record);
      expect(analysisQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ gitUrl: 'https://github.com/owner/repo.git' }),
      );
    });
  });

  describe('when a fresh completed analysis already exists for the same gitUrl', () => {
    it('should return the cached record without creating a new one or enqueuing anything', async () => {
      // Given: a completed analysis created 5 minutes ago (well within the 1h cache window)
      const cached = new AnalysisRecord(
        'cached-id',
        AnalysisStatus.Completed,
        new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        new Date().toISOString(),
        'https://github.com/owner/repo.git',
      );
      analysisRepository.findLatestCompletedByGitUrl.mockResolvedValue(cached);

      // When
      const record = await service.execute({
        gitUrl: 'https://github.com/owner/repo.git',
      });

      // Then
      expect(record).toBe(cached);
      expect(analysisRepository.save).not.toHaveBeenCalled();
      expect(analysisQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('when a completed analysis exists for the same gitUrl but it is older than the cache window', () => {
    it('should ignore the stale cache and submit a brand new analysis', async () => {
      // Given: a completed analysis created 2 hours ago (older than the 1h TTL)
      const stale = new AnalysisRecord(
        'stale-id',
        AnalysisStatus.Completed,
        new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString(),
        'https://github.com/owner/repo.git',
      );
      analysisRepository.findLatestCompletedByGitUrl.mockResolvedValue(stale);

      // When
      const record = await service.execute({
        gitUrl: 'https://github.com/owner/repo.git',
      });

      // Then
      expect(record.id).not.toBe('stale-id');
      expect(record.status).toBe(AnalysisStatus.Processing);
      expect(analysisRepository.save).toHaveBeenCalled();
      expect(analysisQueue.enqueue).toHaveBeenCalled();
    });
  });

  describe('when submitting a ZIP analysis with a matching cached zipHash', () => {
    it('should look up the cache by zipHash instead of gitUrl', async () => {
      // Given: a fresh completed analysis exists for this exact zipHash
      const cached = new AnalysisRecord(
        'cached-zip-id',
        AnalysisStatus.Completed,
        new Date().toISOString(),
        new Date().toISOString(),
        undefined,
        undefined,
        undefined,
        undefined,
        'owner-1',
        AnalysisVisibility.Private,
        'uploads/owner-1/key.zip',
        'abc123hash',
      );
      analysisRepository.findLatestCompletedByZipHash.mockResolvedValue(cached);

      // When
      const record = await service.execute({
        zipS3Key: 'uploads/owner-1/other-key.zip',
        zipHash: 'abc123hash',
        ownerId: 'owner-1',
      });

      // Then
      expect(analysisRepository.findLatestCompletedByZipHash).toHaveBeenCalledWith(
        'abc123hash',
      );
      expect(analysisRepository.findLatestCompletedByGitUrl).not.toHaveBeenCalled();
      expect(record).toBe(cached);
    });
  });

  describe('when enqueuing the job fails after the record was already saved', () => {
    it('should mark the record as failed, persist it again, and throw AnalysisQueueError', async () => {
      // Given: no cache hit, and the queue adapter rejects
      analysisRepository.findLatestCompletedByGitUrl.mockResolvedValue(null);
      analysisQueue.enqueue.mockRejectedValue(new Error('SQS unavailable'));

      // When / Then
      await expect(
        service.execute({ gitUrl: 'https://github.com/owner/repo.git' }),
      ).rejects.toBeInstanceOf(AnalysisQueueError);

      // First save: "processing"; second save: "failed"
      expect(analysisRepository.save).toHaveBeenCalledTimes(2);
      const secondSaveArg = analysisRepository.save.mock.calls[1][0];
      expect(secondSaveArg.status).toBe(AnalysisStatus.Failed);
      expect(secondSaveArg.errorMessage).toBeDefined();
    });
  });
});
