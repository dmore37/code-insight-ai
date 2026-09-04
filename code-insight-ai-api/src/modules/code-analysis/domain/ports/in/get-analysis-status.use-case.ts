import { AnalysisRecord } from '../../entities/analysis-record.entity';

export abstract class GetAnalysisStatusUseCase {
  abstract execute(id: string): Promise<AnalysisRecord>;
}
