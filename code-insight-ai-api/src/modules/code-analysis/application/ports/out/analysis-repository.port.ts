import { AnalysisRecord } from '../../../domain/entities/analysis-record.entity';

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

    abstract findRecentPublicAndByOwnerPage(
    ownerId: string | undefined,
    pageSize: number,
    cursor?: string,
  ): Promise<AnalysisHistoryPage>;
}

