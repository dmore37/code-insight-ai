import { AnalysisRecord } from '../../entities/analysis-record.entity';

/**
 * Puerto de entrada: lista los análisis más recientes (historial).
 */
export abstract class ListAnalysisHistoryUseCase {
  abstract execute(limit?: number): Promise<AnalysisRecord[]>;
}
