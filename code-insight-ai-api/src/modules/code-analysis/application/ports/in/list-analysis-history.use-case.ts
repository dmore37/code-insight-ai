import { AnalysisHistoryPage } from '../out/analysis-repository.port';

export abstract class ListAnalysisHistoryUseCase {
  abstract execute(
    pageSize?: number,
    ownerId?: string,
    cursor?: string,
  ): Promise<AnalysisHistoryPage>;
}
