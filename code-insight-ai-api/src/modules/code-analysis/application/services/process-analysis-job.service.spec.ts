import { ProcessAnalysisJobService } from './process-analysis-job.service';
import { AnalyzeRepositoryUseCase } from '../ports/in/analyze-repository.use-case';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisRecord, AnalysisStatus } from '../../domain/entities/analysis-record.entity';
import { AnalysisResult, ArchitecturePattern } from '../../domain/entities/analysis-result.entity';

describe('GIVEN ProcessAnalysisJobService', () => {
  let analyzeRepository: jest.Mocked<AnalyzeRepositoryUseCase>;
  let analysisRepository: jest.Mocked<AnalysisRepositoryPort>;
  let service: ProcessAnalysisJobService;

  const existingRecord = new AnalysisRecord(
    'job-1',
    AnalysisStatus.Processing,
    new Date().toISOString(),
    new Date().toISOString(),
    'https://github.com/owner/repo.git',
  );

  const analysisResult = new AnalysisResult(
    'ignored-id',
    { projectName: 'repo', mainLanguage: 'TypeScript', mainFramework: 'NestJS', approxFileCount: 10 },
    { summary: 'summary', technologiesDetected: [] },
    { pattern: ArchitecturePattern.Hexagonal, confidence: 0.8, evidences: [] },
    [],
    { recommendations: [], risks: [] },
  );

  beforeEach(() => {
    analyzeRepository = { execute: jest.fn() };
    analysisRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findRecent: jest.fn(),
      findLatestCompletedByGitUrl: jest.fn(),
      findLatestCompletedByZipHash: jest.fn(),
      findRecentPublicAndByOwner: jest.fn(),
      findRecentPublicAndByOwnerPage: jest.fn(),
    };
    service = new ProcessAnalysisJobService(analyzeRepository, analysisRepository);
  });

  describe('GIVEN the referenced record no longer exists', () => {
    it('WHEN execute is called THEN it should skip processing without calling the analyze use case', async () => {
            analysisRepository.findById.mockResolvedValue(null);

            await service.execute({ id: 'missing-job' });

            expect(analyzeRepository.execute).not.toHaveBeenCalled();
      expect(analysisRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN the analysis completes successfully', () => {
    it('WHEN execute is called THEN it should save the record with status "completed" and the job id preserved', async () => {
            analysisRepository.findById.mockResolvedValue(existingRecord);
      analyzeRepository.execute.mockResolvedValue(analysisResult);

            await service.execute({
        id: 'job-1',
        gitUrl: 'https://github.com/owner/repo.git',
      });

            expect(analysisRepository.save).toHaveBeenCalledTimes(1);
      const saved = analysisRepository.save.mock.calls[0][0];
      expect(saved.status).toBe(AnalysisStatus.Completed);
      expect(saved.id).toBe('job-1');
      expect(saved.result?.id).toBe('job-1');
    });
  });

  describe('GIVEN the analysis fails', () => {
    it('WHEN execute is called THEN it should save the record with status "failed" and the error message', async () => {
            analysisRepository.findById.mockResolvedValue(existingRecord);
      analyzeRepository.execute.mockRejectedValue(new Error('Bedrock unavailable'));

            await service.execute({
        id: 'job-1',
        gitUrl: 'https://github.com/owner/repo.git',
      });

            expect(analysisRepository.save).toHaveBeenCalledTimes(1);
      const saved = analysisRepository.save.mock.calls[0][0];
      expect(saved.status).toBe(AnalysisStatus.Failed);
      expect(saved.errorMessage).toBe('Bedrock unavailable');
    });
  });
});
