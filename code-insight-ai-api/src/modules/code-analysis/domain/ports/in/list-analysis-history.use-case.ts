import { AnalysisRecord } from '../../entities/analysis-record.entity';

/**
 * Puerto de entrada: lista los análisis más recientes (historial).
 * Incluye el feed público y, si se indica `ownerId`, también el
 * historial privado (ZIP) de ese usuario.
 */
export abstract class ListAnalysisHistoryUseCase {
  abstract execute(limit?: number, ownerId?: string): Promise<AnalysisRecord[]>;
}
