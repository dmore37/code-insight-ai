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

/**
 * Adaptador de infraestructura: implementa el puerto de dominio usando
 * HttpClient de Angular contra la API real (NestJS en Lambda).
 *
 * Nota: la API responde SIEMPRE con HTTP 200 (ver AllExceptionsFilter en
 * el backend); el resultado de negocio real (éxito/error) viaja dentro
 * del body via el campo `success`. Por eso no usamos `catchError` aquí
 * para errores de negocio: solo fallos reales de red/servidor deberían
 * llegar como error HTTP.
 */
@Injectable({ providedIn: 'root' })
export class HttpAnalysisRepositoryAdapter implements AnalysisRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  async analyze(
    command: AnalyzeRepositoryCommand,
  ): Promise<ApiResponse<AnalysisResult>> {
    const body = {
      gitUrl: command.gitUrl,
      // El zipFile se maneja en una iteración futura (subida a S3 con
      // presigned URL); por ahora el MVP soporta URL git pública.
    };

    return firstValueFrom(
      this.http.post<ApiResponse<AnalysisResult>>(
        `${this.baseUrl}/analysis`,
        body,
      ),
    );
  }
}
