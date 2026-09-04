import { AnalysisRecord } from '../../entities/analysis-record.entity';

/**
 * Puerto de entrada: consulta el estado/resultado de un análisis por id.
 */
export abstract class GetAnalysisStatusUseCase {
  abstract execute(id: string): Promise<AnalysisRecord>;
}
