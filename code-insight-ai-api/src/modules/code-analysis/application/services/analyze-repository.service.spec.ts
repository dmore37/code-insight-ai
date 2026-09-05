import { AnalyzeRepositoryService } from './analyze-repository.service';
import { RepoFetcherPort } from '../ports/out/repo-fetcher.port';
import { StaticAnalyzerPort } from '../ports/out/static-analyzer.port';
import { AiAnalyzerPort } from '../ports/out/ai-analyzer.port';
import { RepositorySource, RepositorySourceType } from '../../domain/entities/repository-source.entity';
import { ArchitecturePattern } from '../../domain/entities/analysis-result.entity';
import {
  MissingRepositorySourceError,
  RepoFetchError,
  StaticAnalysisError,
  AiAnalysisError,
} from '../../domain/errors/code-analysis.errors';

describe('AnalyzeRepositoryService', () => {
  let repoFetcher: jest.Mocked<RepoFetcherPort>;
  let staticAnalyzer: jest.Mocked<StaticAnalyzerPort>;
  let aiAnalyzer: jest.Mocked<AiAnalyzerPort>;
  let service: AnalyzeRepositoryService;

  const source = new RepositorySource(
    RepositorySourceType.Git,
    '/tmp/work-dir',
    'https://github.com/owner/repo.git',
  );

  const staticResult = {
    general: {
      projectName: 'repo',
      mainLanguage: 'TypeScript',
      mainFramework: 'NestJS',
      approxFileCount: 42,
    },
    components: [],
    evidences: [],
    fileTreeSummary: 'src/',
    keyFileExcerpts: [],
  };

  const aiResult = {
    functional: { summary: 'A sample project.', technologiesDetected: ['NestJS'] },
    architecture: {
      pattern: ArchitecturePattern.Hexagonal,
      confidence: 0.9,
      evidences: ['ports/adapters detected'],
    },
    findings: { recommendations: [], risks: [] },
  };

  beforeEach(() => {
    repoFetcher = {
      fetchFromGit: jest.fn(),
      fetchFromZip: jest.fn(),
      fetchFromS3Zip: jest.fn(),
      cleanup: jest.fn(),
    };
    staticAnalyzer = { analyze: jest.fn() };
    aiAnalyzer = { analyze: jest.fn() };

    service = new AnalyzeRepositoryService(repoFetcher, staticAnalyzer, aiAnalyzer);
  });

  describe('when the command has no repository source at all', () => {
    it('should throw MissingRepositorySourceError without touching any port', async () => {
            const command = {};

            await expect(service.execute(command)).rejects.toBeInstanceOf(
        MissingRepositorySourceError,
      );
      expect(repoFetcher.fetchFromGit).not.toHaveBeenCalled();
      expect(staticAnalyzer.analyze).not.toHaveBeenCalled();
      expect(aiAnalyzer.analyze).not.toHaveBeenCalled();
    });
  });

  describe('when analyzing a public git repository end to end', () => {
    it('should fetch, statically analyze, enrich with AI, and clean up the source', async () => {
            repoFetcher.fetchFromGit.mockResolvedValue(source);
      staticAnalyzer.analyze.mockResolvedValue(staticResult);
      aiAnalyzer.analyze.mockResolvedValue(aiResult);

            const result = await service.execute({
        gitUrl: 'https://github.com/owner/repo.git',
      });

            expect(repoFetcher.fetchFromGit).toHaveBeenCalledWith(
        'https://github.com/owner/repo.git',
      );
      expect(staticAnalyzer.analyze).toHaveBeenCalledWith(source);
      expect(aiAnalyzer.analyze).toHaveBeenCalledWith(staticResult);
      expect(result.general).toEqual(staticResult.general);
      expect(result.functional).toEqual(aiResult.functional);
      expect(result.architecture).toEqual(aiResult.architecture);
      expect(result.id).toEqual(expect.any(String));
      expect(repoFetcher.cleanup).toHaveBeenCalledWith(source);
    });
  });

  describe('when the source is a ZIP already uploaded to S3', () => {
    it('should fetch it via fetchFromS3Zip instead of fetchFromGit', async () => {
            const zipSource = new RepositorySource(
        RepositorySourceType.Zip,
        '/tmp/zip-dir',
        'uploads/user-1/abc__project.zip',
      );
      repoFetcher.fetchFromS3Zip.mockResolvedValue(zipSource);
      staticAnalyzer.analyze.mockResolvedValue(staticResult);
      aiAnalyzer.analyze.mockResolvedValue(aiResult);

            await service.execute({ zipS3Key: 'uploads/user-1/abc__project.zip' });

            expect(repoFetcher.fetchFromS3Zip).toHaveBeenCalledWith(
        'uploads/user-1/abc__project.zip',
      );
      expect(repoFetcher.fetchFromGit).not.toHaveBeenCalled();
      expect(repoFetcher.cleanup).toHaveBeenCalledWith(zipSource);
    });
  });

  describe('when fetching the repository source fails', () => {
    it('should wrap the cause into a RepoFetchError and skip static/AI analysis', async () => {
            repoFetcher.fetchFromGit.mockRejectedValue(new Error('clone timed out'));

            await expect(
        service.execute({ gitUrl: 'https://github.com/owner/repo.git' }),
      ).rejects.toBeInstanceOf(RepoFetchError);
      expect(staticAnalyzer.analyze).not.toHaveBeenCalled();
      expect(aiAnalyzer.analyze).not.toHaveBeenCalled();
            expect(repoFetcher.cleanup).not.toHaveBeenCalled();
    });
  });

  describe('when static analysis fails after a successful fetch', () => {
    it('should throw StaticAnalysisError and still clean up the fetched source', async () => {
            repoFetcher.fetchFromGit.mockResolvedValue(source);
      staticAnalyzer.analyze.mockRejectedValue(new Error('unreadable files'));

            await expect(
        service.execute({ gitUrl: 'https://github.com/owner/repo.git' }),
      ).rejects.toBeInstanceOf(StaticAnalysisError);
      expect(aiAnalyzer.analyze).not.toHaveBeenCalled();
      expect(repoFetcher.cleanup).toHaveBeenCalledWith(source);
    });
  });

  describe('when the AI analysis step fails after a successful static analysis', () => {
    it('should throw AiAnalysisError and still clean up the fetched source', async () => {
            repoFetcher.fetchFromGit.mockResolvedValue(source);
      staticAnalyzer.analyze.mockResolvedValue(staticResult);
      aiAnalyzer.analyze.mockRejectedValue(new Error('Bedrock unavailable'));

            await expect(
        service.execute({ gitUrl: 'https://github.com/owner/repo.git' }),
      ).rejects.toBeInstanceOf(AiAnalysisError);
      expect(repoFetcher.cleanup).toHaveBeenCalledWith(source);
    });
  });

  describe('when using the display reference for a ZIP uploaded to S3 in an error message', () => {
    it('should use the readable original file name instead of the raw S3 key', async () => {
            repoFetcher.fetchFromS3Zip.mockRejectedValue(new Error('network error'));

            const promise = service.execute({
        zipS3Key: 'uploads/user-1/11111111-1111-1111-1111-111111111111__my-project.zip',
      });

            await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('my-project.zip'),
      });
    });
  });
});
