import { ListAnalysisHistoryService } from './list-analysis-history.service';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisRecord, AnalysisStatus } from '../entities/analysis-record.entity';

describe('ListAnalysisHistoryService', () => {
  let analysisRepository: jest.Mocked<AnalysisRepositoryPort>;
  let service: ListAnalysisHistoryService;

  const makeRecord = (id: string) =>
    new AnalysisRecord(
      id,
      AnalysisStatus.Completed,
      new Date().toISOString(),
      new Date().toISOString(),
    );

  beforeEach(() => {
    analysisRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findRecent: jest.fn(),
      findLatestCompletedByGitUrl: jest.fn(),
      findLatestCompletedByZipHash: jest.fn(),
      findRecentPublicAndByOwner: jest.fn(),
    };
    service = new ListAnalysisHistoryService(analysisRepository);
  });

  describe('when called without an explicit limit', () => {
    it('should delegate to the repository using the default limit of 20', async () => {
      // Given
      analysisRepository.findRecentPublicAndByOwner.mockResolvedValue([
        makeRecord('a'),
      ]);

      // When
      const result = await service.execute();

      // Then
      expect(analysisRepository.findRecentPublicAndByOwner).toHaveBeenCalledWith(
        undefined,
        20,
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('when called with an explicit limit and ownerId', () => {
    it('should forward both values unchanged to the repository', async () => {
      // Given
      analysisRepository.findRecentPublicAndByOwner.mockResolvedValue([]);

      // When
      await service.execute(5, 'owner-42');

      // Then
      expect(analysisRepository.findRecentPublicAndByOwner).toHaveBeenCalledWith(
        'owner-42',
        5,
      );
    });
  });
});
