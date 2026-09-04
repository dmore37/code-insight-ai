import { AnalysisResult } from './analysis-result.model';

/**
 * Estado del ciclo de vida de un análisis procesado de forma asíncrona
 * (espejo exacto del `AnalysisStatus` del backend).
 */
export type AnalysisStatus = 'processing' | 'completed' | 'failed';

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
  visibility?: 'public' | 'private';
}
