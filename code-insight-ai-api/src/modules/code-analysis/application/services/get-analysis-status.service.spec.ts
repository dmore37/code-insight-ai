import { GetAnalysisStatusService } from './get-analysis-status.service';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisRecord, AnalysisStatus } from '../../domain/entities/analysis-record.entity';
import { AnalysisNotFoundError } from '../../domain/errors/code-analysis.errors';

describe('GetAnalysisStatusService', () => {
  let analysisRepository: jest.Mocked<AnalysisRepositoryPort>;
  let service: GetAnalysisStatusService;

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
    service = new GetAnalysisStatusService(analysisRepository);
  });

  describe('when a record exists for the given id', () => {
    it('should return it as-is', async () => {
            const record = new AnalysisRecord(
        'abc-123',
        AnalysisStatus.Processing,
        new Date().toISOString(),
        new Date().toISOString(),
      );
      analysisRepository.findById.mockResolvedValue(record);

            const result = await service.execute('abc-123');

            expect(result).toBe(record);
      expect(analysisRepository.findById).toHaveBeenCalledWith('abc-123');
    });
  });

  describe('when no record exists for the given id', () => {
    it('should throw AnalysisNotFoundError', async () => {
            analysisRepository.findById.mockResolvedValue(null);

            await expect(service.execute('missing-id')).rejects.toBeInstanceOf(
        AnalysisNotFoundError,
      );
    });
  });
});
