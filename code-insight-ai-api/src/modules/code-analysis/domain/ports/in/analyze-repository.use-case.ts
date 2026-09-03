import { AnalysisResult } from '../../entities/analysis-result.entity';

export interface AnalyzeRepositoryCommand {
  /** URL de un repositorio git público (opción 1) */
  gitUrl?: string;
  /** Ruta local a un archivo ZIP ya subido/descargado (opción 2) */
  zipFilePath?: string;
}

/**
 * Puerto de entrada (caso de uso) que orquesta todo el análisis.
 */
export abstract class AnalyzeRepositoryUseCase {
  abstract execute(command: AnalyzeRepositoryCommand): Promise<AnalysisResult>;
}
