import { SubmitAnalysisService } from './submit-analysis.service';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisQueuePort } from '../ports/out/analysis-queue.port';
import { RateLimiterPort } from '../ports/out/rate-limiter.port';
import { AnalysisRecord, AnalysisStatus, AnalysisVisibility } from '../../domain/entities/analysis-record.entity';
import { MissingRepositorySourceError, AnalysisQueueError } from '../../domain/errors/code-analysis.errors';

describe('GIVEN SubmitAnalysisService', () => {
  let analysisRepository: jest.Mocked<AnalysisRepositoryPort>;
  let analysisQueue: jest.Mocked<AnalysisQueuePort>;
  let rateLimiter: jest.Mocked<RateLimiterPort>;
  let service: SubmitAnalysisService;

  beforeEach(() => {
    analysisRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findRecent: jest.fn(),
      findLatestCompletedByGitUrl: jest.fn(),
      findLatestCompletedByZipHash: jest.fn(),
      findRecentPublicAndByOwner: jest.fn(),
      findRecentPublicAndByOwnerPage: jest.fn(),
    };
    analysisQueue = { enqueue: jest.fn() };
    rateLimiter = { tryConsume: jest.fn().mockResolvedValue(true) };

    service = new SubmitAnalysisService(analysisRepository, analysisQueue, rateLimiter);
  });

  describe('GIVEN the command has no repository source at all', () => {
    it('WHEN execute is called THEN it should throw MissingRepositorySourceError without saving or enqueuing anything', async () => {
            const command = {};

            await expect(service.execute(command)).rejects.toBeInstanceOf(
        MissingRepositorySourceError,
      );
      expect(analysisRepository.save).not.toHaveBeenCalled();
      expect(analysisQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN submitting a new gitUrl analysis with no cached result', () => {
    it('WHEN execute is called THEN it should create a "processing" record, persist it and enqueue the job', async () => {
            analysisRepository.findLatestCompletedByGitUrl.mockResolvedValue(null);

            const record = await service.execute({
        gitUrl: 'https://github.com/owner/repo.git',
      });

            expect(record.status).toBe(AnalysisStatus.Processing);
      expect(record.visibility).toBe(AnalysisVisibility.Public);
      expect(analysisRepository.save).toHaveBeenCalledWith(record);
      expect(analysisQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ gitUrl: 'https://github.com/owner/repo.git' }),
      );
    });
  });

  describe('GIVEN a fresh completed analysis already exists for the same gitUrl', () => {
    it('WHEN execute is called THEN it should return the cached record without creating a new one or enqueuing anything', async () => {
            const cached = new AnalysisRecord(
        'cached-id',
        AnalysisStatus.Completed,
        new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        new Date().toISOString(),
        'https://github.com/owner/repo.git',
      );
      analysisRepository.findLatestCompletedByGitUrl.mockResolvedValue(cached);

            const record = await service.execute({
        gitUrl: 'https://github.com/owner/repo.git',
      });

            expect(record).toBe(cached);
      expect(analysisRepository.save).not.toHaveBeenCalled();
      expect(analysisQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a completed analysis exists for the same gitUrl but it is older than the cache window', () => {
    it('WHEN execute is called THEN it should ignore the stale cache and submit a brand new analysis', async () => {
            const stale = new AnalysisRecord(
        'stale-id',
        AnalysisStatus.Completed,
        new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString(),
        'https://github.com/owner/repo.git',
      );
      analysisRepository.findLatestCompletedByGitUrl.mockResolvedValue(stale);

            const record = await service.execute({
        gitUrl: 'https://github.com/owner/repo.git',
      });

            expect(record.id).not.toBe('stale-id');
      expect(record.status).toBe(AnalysisStatus.Processing);
      expect(analysisRepository.save).toHaveBeenCalled();
      expect(analysisQueue.enqueue).toHaveBeenCalled();
    });
  });

  describe('GIVEN submitting a ZIP analysis with a matching cached zipHash', () => {
    it('WHEN execute is called THEN it should look up the cache by zipHash instead of gitUrl', async () => {
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

            const record = await service.execute({
        zipS3Key: 'uploads/owner-1/other-key.zip',
        zipHash: 'abc123hash',
        ownerId: 'owner-1',
      });

            expect(analysisRepository.findLatestCompletedByZipHash).toHaveBeenCalledWith(
        'abc123hash',
      );
      expect(analysisRepository.findLatestCompletedByGitUrl).not.toHaveBeenCalled();
      expect(record).toBe(cached);
    });
  });

  describe('GIVEN enqueuing the job fails after the record was already saved', () => {
    it('WHEN execute is called THEN it should mark the record as failed, persist it again, and throw AnalysisQueueError', async () => {
            analysisRepository.findLatestCompletedByGitUrl.mockResolvedValue(null);
      analysisQueue.enqueue.mockRejectedValue(new Error('SQS unavailable'));

            await expect(
        service.execute({ gitUrl: 'https://github.com/owner/repo.git' }),
      ).rejects.toBeInstanceOf(AnalysisQueueError);

            expect(analysisRepository.save).toHaveBeenCalledTimes(2);
      const secondSaveArg = analysisRepository.save.mock.calls[1][0];
      expect(secondSaveArg.status).toBe(AnalysisStatus.Failed);
      expect(secondSaveArg.errorMessage).toBeDefined();
    });
  });
});
