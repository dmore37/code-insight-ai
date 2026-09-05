import { ApiResponse } from '../../domain/models/api-response.model';
import { AnalysisResult } from '../../domain/models/analysis-result.model';

export interface AnalyzeRepositoryCommand {
  gitUrl?: string;
  zipFile?: File;

  zipS3Key?: string;

  zipHash?: string;
}

export abstract class AnalysisRepositoryPort {
  abstract analyze(
    command: AnalyzeRepositoryCommand,
  ): Promise<ApiResponse<AnalysisResult>>;
}
