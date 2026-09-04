import { ApiResponse } from '../models/api-response.model';
import { AnalysisRecord } from '../models/analysis-record.model';
import { AnalyzeRepositoryCommand } from './analysis-repository.port';

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
}

export abstract class AnalysisHistoryPort {
  abstract submitAsync(
    command: AnalyzeRepositoryCommand,
  ): Promise<ApiResponse<AnalysisRecord>>;
  abstract getHistory(limit?: number): Promise<ApiResponse<AnalysisRecord[]>>;
  abstract getStatus(id: string): Promise<ApiResponse<AnalysisRecord>>;

  abstract requestZipUploadUrl(
    fileName?: string,
  ): Promise<ApiResponse<PresignedUpload>>;
}
