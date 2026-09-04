import { AnalysisResult } from '../../entities/analysis-result.entity';

export interface AnalyzeRepositoryCommand {
  /** URL de un repositorio git público (opción 1) */
  gitUrl?: string;
  /** Ruta local a un archivo ZIP ya subido/descargado (opción 2) */
  zipFilePath?: string;
  /** Key de un ZIP subido a S3 mediante URL prefirmada (opción 3) */
  zipS3Key?: string;
  /** Hash SHA-256 del ZIP (calculado en el cliente), usado para cachear resultados. */
  zipHash?: string;
  /** Id del usuario autenticado (dueño del análisis), si aplica */
  ownerId?: string;
}

/**
 * Puerto de entrada (caso de uso) que orquesta todo el análisis.
 */
export abstract class AnalyzeRepositoryUseCase {
  abstract execute(command: AnalyzeRepositoryCommand): Promise<AnalysisResult>;
}

