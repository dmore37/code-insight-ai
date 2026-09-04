import { AnalyzeRepositoryService } from './analyze-repository.service';
import { RepoFetcherPort } from '../ports/out/repo-fetcher.port';
import { StaticAnalyzerPort } from '../ports/out/static-analyzer.port';
import { AiAnalyzerPort } from '../ports/out/ai-analyzer.port';
import { RepositorySource, RepositorySourceType } from '../entities/repository-source.entity';
import { ArchitecturePattern } from '../entities/analysis-result.entity';
import {
  MissingRepositorySourceError,
  RepoFetchError,
  StaticAnalysisError,
  AiAnalysisError,
} from '../errors/code-analysis.errors';

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
      // Given: a command missing gitUrl, zipFilePath and zipS3Key
      const command = {};

      // When / Then
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
      // Given: a valid gitUrl and all ports resolving successfully
      repoFetcher.fetchFromGit.mockResolvedValue(source);
      staticAnalyzer.analyze.mockResolvedValue(staticResult);
      aiAnalyzer.analyze.mockResolvedValue(aiResult);

      // When
      const result = await service.execute({
        gitUrl: 'https://github.com/owner/repo.git',
      });

      // Then
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
      // Given: a command with only a zipS3Key
      const zipSource = new RepositorySource(
        RepositorySourceType.Zip,
        '/tmp/zip-dir',
        'uploads/user-1/abc__project.zip',
      );
      repoFetcher.fetchFromS3Zip.mockResolvedValue(zipSource);
      staticAnalyzer.analyze.mockResolvedValue(staticResult);
      aiAnalyzer.analyze.mockResolvedValue(aiResult);

      // When
      await service.execute({ zipS3Key: 'uploads/user-1/abc__project.zip' });

      // Then
      expect(repoFetcher.fetchFromS3Zip).toHaveBeenCalledWith(
        'uploads/user-1/abc__project.zip',
      );
      expect(repoFetcher.fetchFromGit).not.toHaveBeenCalled();
      expect(repoFetcher.cleanup).toHaveBeenCalledWith(zipSource);
    });
  });

  describe('when fetching the repository source fails', () => {
    it('should wrap the cause into a RepoFetchError and skip static/AI analysis', async () => {
      // Given: fetchFromGit rejects with a low-level error
      repoFetcher.fetchFromGit.mockRejectedValue(new Error('clone timed out'));

      // When / Then
      await expect(
        service.execute({ gitUrl: 'https://github.com/owner/repo.git' }),
      ).rejects.toBeInstanceOf(RepoFetchError);
      expect(staticAnalyzer.analyze).not.toHaveBeenCalled();
      expect(aiAnalyzer.analyze).not.toHaveBeenCalled();
      // cleanup is only called for a successfully fetched source
      expect(repoFetcher.cleanup).not.toHaveBeenCalled();
    });
  });

  describe('when static analysis fails after a successful fetch', () => {
    it('should throw StaticAnalysisError and still clean up the fetched source', async () => {
      // Given: fetch succeeds but static analysis rejects
      repoFetcher.fetchFromGit.mockResolvedValue(source);
      staticAnalyzer.analyze.mockRejectedValue(new Error('unreadable files'));

      // When / Then
      await expect(
        service.execute({ gitUrl: 'https://github.com/owner/repo.git' }),
      ).rejects.toBeInstanceOf(StaticAnalysisError);
      expect(aiAnalyzer.analyze).not.toHaveBeenCalled();
      expect(repoFetcher.cleanup).toHaveBeenCalledWith(source);
    });
  });

  describe('when the AI analysis step fails after a successful static analysis', () => {
    it('should throw AiAnalysisError and still clean up the fetched source', async () => {
      // Given: fetch and static analysis succeed but AI analysis rejects
      repoFetcher.fetchFromGit.mockResolvedValue(source);
      staticAnalyzer.analyze.mockResolvedValue(staticResult);
      aiAnalyzer.analyze.mockRejectedValue(new Error('Bedrock unavailable'));

      // When / Then
      await expect(
        service.execute({ gitUrl: 'https://github.com/owner/repo.git' }),
      ).rejects.toBeInstanceOf(AiAnalysisError);
      expect(repoFetcher.cleanup).toHaveBeenCalledWith(source);
    });
  });

  describe('when using the display reference for a ZIP uploaded to S3 in an error message', () => {
    it('should use the readable original file name instead of the raw S3 key', async () => {
      // Given: fetchFromS3Zip fails for a key with the "uploads/{owner}/{uuid}__name.zip" shape
      repoFetcher.fetchFromS3Zip.mockRejectedValue(new Error('network error'));

      // When
      const promise = service.execute({
        zipS3Key: 'uploads/user-1/11111111-1111-1111-1111-111111111111__my-project.zip',
      });

      // Then
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('my-project.zip'),
      });
    });
  });
});
