import { AnalysisRecord } from '../../entities/analysis-record.entity';

export abstract class ListAnalysisHistoryUseCase {
  abstract execute(limit?: number, ownerId?: string): Promise<AnalysisRecord[]>;
}
