import { AnalysisRecord } from '../../entities/analysis-record.entity';

export interface AnalysisHistoryPage {
  items: AnalysisRecord[];
  nextCursor?: string;
}

export abstract class AnalysisRepositoryPort {
  abstract save(record: AnalysisRecord): Promise<void>;
  abstract findById(id: string): Promise<AnalysisRecord | null>;
  abstract findRecent(limit: number): Promise<AnalysisRecord[]>;

  abstract findLatestCompletedByGitUrl(
    gitUrl: string,
  ): Promise<AnalysisRecord | null>;

  abstract findLatestCompletedByZipHash(
    zipHash: string,
  ): Promise<AnalysisRecord | null>;

  abstract findRecentPublicAndByOwner(
    ownerId: string | undefined,
    limit: number,
  ): Promise<AnalysisRecord[]>;

  /**
   * Versión paginada (con cursor) de `findRecentPublicAndByOwner`.
   *
   * `findRecentPublicAndByOwner` mezcla en memoria DOS queries de
   * DynamoDB (feed público por `byCreatedAt` + registros propios por
   * `byOwner`), las deduplica y las re-ordena por `createdAt`. Un
   * `LastEvaluatedKey` de una sola query no sirve para paginar ese
   * resultado combinado, así que este método implementa un "k-way merge"
   * con un buffer de lookahead por cada fuente, codificado de forma
   * opaca en `cursor` (base64). Ver la implementación en el adapter para
   * el detalle del algoritmo.
   */
  abstract findRecentPublicAndByOwnerPage(
    ownerId: string | undefined,
    pageSize: number,
    cursor?: string,
  ): Promise<AnalysisHistoryPage>;
}

