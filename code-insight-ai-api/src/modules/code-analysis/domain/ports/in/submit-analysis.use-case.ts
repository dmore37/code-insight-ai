import { AnalysisRecord } from '../../entities/analysis-record.entity';
import { AnalyzeRepositoryCommand } from './analyze-repository.use-case';

export abstract class SubmitAnalysisUseCase {
  abstract execute(command: AnalyzeRepositoryCommand): Promise<AnalysisRecord>;
}
