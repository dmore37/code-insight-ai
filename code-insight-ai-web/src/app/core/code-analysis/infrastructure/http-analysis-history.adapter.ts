import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../domain/models/api-response.model';
import { AnalysisRecord } from '../domain/models/analysis-record.model';
import {
  AnalysisHistoryPort,
  PresignedUpload,
} from '../domain/ports/analysis-history.port';
import { AnalyzeRepositoryCommand } from '../domain/ports/analysis-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpAnalysisHistoryAdapter implements AnalysisHistoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  async submitAsync(
    command: AnalyzeRepositoryCommand,
  ): Promise<ApiResponse<AnalysisRecord>> {
    const body = {
      gitUrl: command.gitUrl,
      zipS3Key: command.zipS3Key,
      zipHash: command.zipHash,
    };
    return firstValueFrom(
      this.http.post<ApiResponse<AnalysisRecord>>(
        `${this.baseUrl}/analysis/async`,
        body,
      ),
    );
  }

  async getHistory(limit = 20): Promise<ApiResponse<AnalysisRecord[]>> {
    return firstValueFrom(
      this.http.get<ApiResponse<AnalysisRecord[]>>(
        `${this.baseUrl}/analysis`,
        { params: { limit } },
      ),
    );
  }

  async getStatus(id: string): Promise<ApiResponse<AnalysisRecord>> {
    return firstValueFrom(
      this.http.get<ApiResponse<AnalysisRecord>>(
        `${this.baseUrl}/analysis/${id}`,
      ),
    );
  }

  async requestZipUploadUrl(
    fileName?: string,
  ): Promise<ApiResponse<PresignedUpload>> {
    return firstValueFrom(
      this.http.post<ApiResponse<PresignedUpload>>(
        `${this.baseUrl}/analysis/zip/upload-url`,
        { fileName },
      ),
    );
  }
}
