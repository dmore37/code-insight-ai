import { AnalysisRecord } from '../../entities/analysis-record.entity';

/**
 * Puerto de salida para la persistencia del historial de análisis
 * (implementado en infraestructura por un adaptador de DynamoDB).
 */
export abstract class AnalysisRepositoryPort {
  abstract save(record: AnalysisRecord): Promise<void>;
  abstract findById(id: string): Promise<AnalysisRecord | null>;
  abstract findRecent(limit: number): Promise<AnalysisRecord[]>;
  /**
   * Busca el análisis "completed" más reciente para una URL git dada
   * (usado como caché: evita repetir el análisis con IA si ya existe uno
   * reciente para la misma URL). Devuelve null si no hay ninguno.
   */
  abstract findLatestCompletedByGitUrl(
    gitUrl: string,
  ): Promise<AnalysisRecord | null>;
}
