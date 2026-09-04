import { ApiResponse } from '../models/api-response.model';
import { AnalysisRecord } from '../models/analysis-record.model';
import { AnalyzeRepositoryCommand } from './analysis-repository.port';

/** Respuesta con la URL prefirmada de S3 para subir un ZIP directamente. */
export interface PresignedUpload {
  uploadUrl: string;
  key: string;
}

/**
 * Puerto de salida: historial de análisis (DynamoDB en el backend),
 * envío de un análisis para procesamiento asíncrono (SQS) y consulta de
 * su estado. Se mantiene separado de `AnalysisRepositoryPort` porque
 * representa un caso de uso distinto (asíncrono/historial) y no el
 * análisis síncrono original.
 */
export abstract class AnalysisHistoryPort {
  abstract submitAsync(
    command: AnalyzeRepositoryCommand,
  ): Promise<ApiResponse<AnalysisRecord>>;
  abstract getHistory(limit?: number): Promise<ApiResponse<AnalysisRecord[]>>;
  abstract getStatus(id: string): Promise<ApiResponse<AnalysisRecord>>;
  /** Solicita una URL prefirmada de S3 para subir un ZIP directamente. */
  abstract requestZipUploadUrl(
    fileName?: string,
  ): Promise<ApiResponse<PresignedUpload>>;
}
