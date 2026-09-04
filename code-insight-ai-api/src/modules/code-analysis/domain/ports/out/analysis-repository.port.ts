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
  /**
   * Igual que `findLatestCompletedByGitUrl` pero para análisis por ZIP,
   * usando el hash SHA-256 del contenido (calculado en el cliente) como
   * clave de caché, ya que dos ZIPs distintos (nombres/keys de S3
   * distintos) pueden tener exactamente el mismo contenido.
   */
  abstract findLatestCompletedByZipHash(
    zipHash: string,
  ): Promise<AnalysisRecord | null>;
  /**
   * Historial combinado: análisis públicos (feed general, GSI
   * "byCreatedAt") + análisis privados del dueño indicado (GSI "byOwner").
   * Si `ownerId` es undefined, solo devuelve el feed público.
   */
  abstract findRecentPublicAndByOwner(
    ownerId: string | undefined,
    limit: number,
  ): Promise<AnalysisRecord[]>;
}

