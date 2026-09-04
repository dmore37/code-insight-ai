import { AnalysisResult } from './analysis-result.model';

/**
 * Estado del ciclo de vida de un análisis procesado de forma asíncrona
 * (espejo exacto del `AnalysisStatus` del backend).
 */
export enum AnalysisStatus {
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Visibilidad de un registro (espejo exacto del `AnalysisVisibility` del
 * backend): "public" (análisis por URL git) o "private" (análisis por ZIP).
 */
export enum AnalysisVisibility {
  Public = 'public',
  Private = 'private',
}

/**
 * Registro de historial de análisis (persistido en DynamoDB en el backend),
 * en espejo con la entidad `AnalysisRecord` de NestJS.
 */
export interface AnalysisRecord {
  id: string;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  gitUrl?: string;
  zipFilePath?: string;
  zipS3Key?: string;
  zipHash?: string;
  result?: AnalysisResult;
  errorMessage?: string;
  ownerId?: string;
  visibility?: AnalysisVisibility;
}

