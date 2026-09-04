import { Module } from '@nestjs/common';
import { AnalysisController } from '../adapters/in/http/analysis.controller';
import { AnalyzeRepositoryUseCase } from '../../domain/ports/in/analyze-repository.use-case';
import { AnalyzeRepositoryService } from '../../domain/services/analyze-repository.service';
import { SubmitAnalysisUseCase } from '../../domain/ports/in/submit-analysis.use-case';
import { SubmitAnalysisService } from '../../domain/services/submit-analysis.service';
import { GetAnalysisStatusUseCase } from '../../domain/ports/in/get-analysis-status.use-case';
import { GetAnalysisStatusService } from '../../domain/services/get-analysis-status.service';
import { ListAnalysisHistoryUseCase } from '../../domain/ports/in/list-analysis-history.use-case';
import { ListAnalysisHistoryService } from '../../domain/services/list-analysis-history.service';
import { ProcessAnalysisJobUseCase } from '../../domain/ports/in/process-analysis-job.use-case';
import { ProcessAnalysisJobService } from '../../domain/services/process-analysis-job.service';
import { GetZipUploadUrlUseCase } from '../../domain/ports/in/get-zip-upload-url.use-case';
import { GetZipUploadUrlService } from '../../domain/services/get-zip-upload-url.service';
import { FilesystemRepoFetcherAdapter } from '../adapters/out/filesystem-repo-fetcher.adapter';
import { HeuristicStaticAnalyzerAdapter } from '../adapters/out/heuristic-static-analyzer.adapter';
import { BedrockAiAnalyzerAdapter } from '../adapters/out/bedrock-ai-analyzer.adapter';
import { DynamoDbAnalysisRepositoryAdapter } from '../adapters/out/dynamodb-analysis-repository.adapter';
import { SqsAnalysisQueueAdapter } from '../adapters/out/sqs-analysis-queue.adapter';
import { S3ZipUploadAdapter } from '../adapters/out/s3-zip-upload.adapter';
import { DynamoDbRateLimiterAdapter } from '../adapters/out/dynamodb-rate-limiter.adapter';
import {
  REPO_FETCHER_PORT,
  STATIC_ANALYZER_PORT,
  AI_ANALYZER_PORT,
  ANALYSIS_REPOSITORY_PORT,
  ANALYSIS_QUEUE_PORT,
  ZIP_UPLOAD_PORT,
  RATE_LIMITER_PORT,
} from './tokens';

@Module({
  controllers: [AnalysisController],
  providers: [
    {
      provide: AnalyzeRepositoryUseCase,
      useClass: AnalyzeRepositoryService,
    },
    {
      provide: SubmitAnalysisUseCase,
      useClass: SubmitAnalysisService,
    },
    {
      provide: GetAnalysisStatusUseCase,
      useClass: GetAnalysisStatusService,
    },
    {
      provide: ListAnalysisHistoryUseCase,
      useClass: ListAnalysisHistoryService,
    },
    {
      provide: ProcessAnalysisJobUseCase,
      useClass: ProcessAnalysisJobService,
    },
    {
      provide: GetZipUploadUrlUseCase,
      useClass: GetZipUploadUrlService,
    },
    {
      provide: REPO_FETCHER_PORT,
      useClass: FilesystemRepoFetcherAdapter,
    },
    {
      provide: STATIC_ANALYZER_PORT,
      useClass: HeuristicStaticAnalyzerAdapter,
    },
    {
      provide: AI_ANALYZER_PORT,
      useClass: BedrockAiAnalyzerAdapter,
    },
    {
      provide: ANALYSIS_REPOSITORY_PORT,
      useClass: DynamoDbAnalysisRepositoryAdapter,
    },
    {
      provide: ANALYSIS_QUEUE_PORT,
      useClass: SqsAnalysisQueueAdapter,
    },
    {
      provide: ZIP_UPLOAD_PORT,
      useClass: S3ZipUploadAdapter,
    },
    {
      provide: RATE_LIMITER_PORT,
      useClass: DynamoDbRateLimiterAdapter,
    },
  ],
  exports: [ProcessAnalysisJobUseCase],
})
export class CodeAnalysisModule {}
