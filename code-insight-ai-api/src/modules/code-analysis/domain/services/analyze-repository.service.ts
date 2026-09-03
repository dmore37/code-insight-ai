import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AnalyzeRepositoryCommand,
  AnalyzeRepositoryUseCase,
} from '../ports/in/analyze-repository.use-case';
import { RepoFetcherPort } from '../ports/out/repo-fetcher.port';
import { StaticAnalyzerPort } from '../ports/out/static-analyzer.port';
import { AiAnalyzerPort } from '../ports/out/ai-analyzer.port';
import { AnalysisResult } from '../entities/analysis-result.entity';
import {
  REPO_FETCHER_PORT,
  STATIC_ANALYZER_PORT,
  AI_ANALYZER_PORT,
} from '../../infrastructure/config/tokens';
import {
  MissingRepositorySourceError,
  RepoFetchError,
  StaticAnalysisError,
  AiAnalysisError,
} from '../errors/code-analysis.errors';
import { AppError } from '../../../../shared/errors/app-error';

@Injectable()
export class AnalyzeRepositoryService implements AnalyzeRepositoryUseCase {
  constructor(
    @Inject(REPO_FETCHER_PORT) private readonly repoFetcher: RepoFetcherPort,
    @Inject(STATIC_ANALYZER_PORT)
    private readonly staticAnalyzer: StaticAnalyzerPort,
    @Inject(AI_ANALYZER_PORT) private readonly aiAnalyzer: AiAnalyzerPort,
  ) {}

  async execute(command: AnalyzeRepositoryCommand): Promise<AnalysisResult> {
    if (!command.gitUrl && !command.zipFilePath) {
      throw new MissingRepositorySourceError();
    }

    const reference = command.gitUrl ?? command.zipFilePath!;
    const source = await this.fetchSource(command);

    try {
      const staticResult = await this.staticAnalyzer
        .analyze(source)
        .catch((cause) => {
          throw new StaticAnalysisError(cause);
        });

      const aiResult = await this.aiAnalyzer
        .analyze(staticResult)
        .catch((cause) => {
          throw new AiAnalysisError(cause);
        });

      return new AnalysisResult(
        randomUUID(),
        staticResult.general,
        aiResult.functional,
        aiResult.architecture,
        staticResult.components,
        aiResult.findings,
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new RepoFetchError(reference, error);
    } finally {
      await this.repoFetcher.cleanup(source);
    }
  }

  private async fetchSource(command: AnalyzeRepositoryCommand) {
    const reference = command.gitUrl ?? command.zipFilePath!;
    try {
      return command.gitUrl
        ? await this.repoFetcher.fetchFromGit(command.gitUrl)
        : await this.repoFetcher.fetchFromZip(command.zipFilePath!);
    } catch (cause) {
      throw new RepoFetchError(reference, cause);
    }
  }
}
