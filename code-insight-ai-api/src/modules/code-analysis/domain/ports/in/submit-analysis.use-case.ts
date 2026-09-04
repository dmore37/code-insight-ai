import { AnalysisRecord } from '../../entities/analysis-record.entity';
import { AnalyzeRepositoryCommand } from './analyze-repository.use-case';

/**
 * Puerto de entrada: encola una solicitud de análisis para procesamiento
 * asíncrono y devuelve de inmediato el registro con status "processing".
 */
export abstract class SubmitAnalysisUseCase {
  abstract execute(command: AnalyzeRepositoryCommand): Promise<AnalysisRecord>;
}
