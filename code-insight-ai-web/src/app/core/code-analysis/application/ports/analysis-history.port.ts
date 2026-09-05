import { ApiResponse } from '../../domain/models/api-response.model';
import { AnalysisRecord } from '../../domain/models/analysis-record.model';
import { AnalyzeRepositoryCommand } from './analysis-repository.port';

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
}

export interface AnalysisHistoryPage {
  items: AnalysisRecord[];
  nextCursor?: string;
}

export abstract class AnalysisHistoryPort {
  abstract submitAsync(
    command: AnalyzeRepositoryCommand,
  ): Promise<ApiResponse<AnalysisRecord>>;
  abstract getHistory(
    pageSize?: number,
    cursor?: string,
  ): Promise<ApiResponse<AnalysisHistoryPage>>;
  abstract getStatus(id: string): Promise<ApiResponse<AnalysisRecord>>;

  abstract requestZipUploadUrl(
    fileName?: string,
  ): Promise<ApiResponse<PresignedUpload>>;
}
