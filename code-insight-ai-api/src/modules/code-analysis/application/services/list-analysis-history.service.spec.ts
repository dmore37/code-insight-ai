import { ListAnalysisHistoryService } from './list-analysis-history.service';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisRecord, AnalysisStatus } from '../../domain/entities/analysis-record.entity';

describe('GIVEN ListAnalysisHistoryService', () => {
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
      findRecentPublicAndByOwnerPage: jest.fn(),
    };
    service = new ListAnalysisHistoryService(analysisRepository);
  });

  describe('GIVEN it is called without an explicit limit', () => {
    it('WHEN execute is called THEN it should delegate to the repository using the default limit of 20', async () => {
            analysisRepository.findRecentPublicAndByOwnerPage.mockResolvedValue({
        items: [makeRecord('a')],
      });

            const result = await service.execute();

            expect(analysisRepository.findRecentPublicAndByOwnerPage).toHaveBeenCalledWith(
        undefined,
        20,
        undefined,
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('GIVEN it is called with an explicit limit and ownerId', () => {
    it('WHEN execute is called THEN it should forward both values unchanged to the repository', async () => {
            analysisRepository.findRecentPublicAndByOwnerPage.mockResolvedValue({
        items: [],
      });

            await service.execute(5, 'owner-42');

            expect(analysisRepository.findRecentPublicAndByOwnerPage).toHaveBeenCalledWith(
        'owner-42',
        5,
        undefined,
      );
    });
  });
});
