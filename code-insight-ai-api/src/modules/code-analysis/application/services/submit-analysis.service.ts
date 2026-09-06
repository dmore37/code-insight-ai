import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SubmitAnalysisUseCase } from '../ports/in/submit-analysis.use-case';
import { AnalyzeRepositoryCommand } from '../ports/in/analyze-repository.use-case';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisQueuePort } from '../ports/out/analysis-queue.port';
import { RateLimiterPort } from '../ports/out/rate-limiter.port';
import { AnalysisRecord } from '../../domain/entities/analysis-record.entity';
import {
  ANALYSIS_REPOSITORY_PORT,
  ANALYSIS_QUEUE_PORT,
  RATE_LIMITER_PORT,
} from '../../infrastructure/config/tokens';
import { MissingRepositorySourceError, AnalysisQueueError } from '../../domain/errors/code-analysis.errors';
import { RateLimitExceededError } from '../../../../shared/errors/app-error';
import { CACHE_TTL_MS } from '../../domain/config/business-rules.constants';

@Injectable()
export class SubmitAnalysisService implements SubmitAnalysisUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Inject(ANALYSIS_QUEUE_PORT)
    private readonly analysisQueue: AnalysisQueuePort,
    @Inject(RATE_LIMITER_PORT)
    private readonly rateLimiter: RateLimiterPort,
  ) { }

  async execute(command: AnalyzeRepositoryCommand): Promise<AnalysisRecord> {
    if (!command.gitUrl && !command.zipFilePath && !command.zipS3Key) {
      throw new MissingRepositorySourceError();
    }

    if (command.gitUrl) {
      const cached = await this.findFreshCached(() =>
        this.analysisRepository.findLatestCompletedByGitUrl(command.gitUrl!),
      );
      if (cached) return cached;
    } else if (command.zipHash) {
      const cached = await this.findFreshCached(() =>
        this.analysisRepository.findLatestCompletedByZipHash(
          command.zipHash!,
        ),
      );
      if (cached) return cached;
    }

    if (command.rateLimitKey && command.rateLimitMax) {
      const allowed = await this.rateLimiter.tryConsume(
        command.rateLimitKey,
        command.rateLimitMax,
      );
      if (!allowed) throw new RateLimitExceededError();
    }

    const id = randomUUID();
    const record = AnalysisRecord.createProcessing(
      id,
      command,
      command.ownerId,
    );

    await this.analysisRepository.save(record);

    try {
      await this.analysisQueue.enqueue({
        id,
        gitUrl: command.gitUrl,
        zipFilePath: command.zipFilePath,
        zipS3Key: command.zipS3Key,
      });
    } catch (cause) {
      const failedRecord = record.withFailed(
        'No fue posible encolar el análisis.',
      );
      await this.analysisRepository.save(failedRecord);
      throw new AnalysisQueueError(cause);
    }

    return record;
  }

  private async findFreshCached(
    finder: () => Promise<AnalysisRecord | null>,
  ): Promise<AnalysisRecord | null> {
    const cached = await finder();
    if (!cached) return null;

    const ageMs = Date.now() - new Date(cached.createdAt).getTime();
    return ageMs < CACHE_TTL_MS ? cached : null;
  }
}
