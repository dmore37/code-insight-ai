import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../domain/models/api-response.model';
import { AnalysisResult } from '../domain/models/analysis-result.model';
import {
  AnalysisRepositoryPort,
  AnalyzeRepositoryCommand,
} from '../domain/ports/analysis-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpAnalysisRepositoryAdapter implements AnalysisRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  async analyze(
    command: AnalyzeRepositoryCommand,
  ): Promise<ApiResponse<AnalysisResult>> {
    const body = {
      gitUrl: command.gitUrl,

    };

    return firstValueFrom(
      this.http.post<ApiResponse<AnalysisResult>>(
        `${this.baseUrl}/analysis`,
        body,
      ),
    );
  }
}
