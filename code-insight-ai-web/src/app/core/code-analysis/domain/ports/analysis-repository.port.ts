import { ApiResponse } from '../models/api-response.model';
import { AnalysisResult } from '../models/analysis-result.model';

/** Comando de entrada para solicitar el análisis de un repositorio. */
export interface AnalyzeRepositoryCommand {
  gitUrl?: string;
  zipFile?: File;
}

/**
 * Puerto de salida: contrato abstracto para obtener el análisis de un
 * repositorio, sin acoplarse a ningún mecanismo de transporte concreto
 * (HttpClient, fetch, mocks de test, etc.). Los adaptadores de
 * infraestructura (ej. HttpAnalysisRepositoryAdapter) implementan esta
 * clase abstracta inyectándose vía Angular DI.
 */
export abstract class AnalysisRepositoryPort {
  abstract analyze(
    command: AnalyzeRepositoryCommand,
  ): Promise<ApiResponse<AnalysisResult>>;
}
