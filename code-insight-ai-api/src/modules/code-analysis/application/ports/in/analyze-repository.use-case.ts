import { AnalysisResult } from '../../../domain/entities/analysis-result.entity';

export interface AnalyzeRepositoryCommand {

  gitUrl?: string;

  zipFilePath?: string;

  zipS3Key?: string;

  zipHash?: string;

  ownerId?: string;

    rateLimitKey?: string;

  rateLimitMax?: number;
}

export abstract class AnalyzeRepositoryUseCase {
  abstract execute(command: AnalyzeRepositoryCommand): Promise<AnalysisResult>;
}

