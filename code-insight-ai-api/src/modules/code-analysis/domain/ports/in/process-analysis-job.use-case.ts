import { AnalysisJobMessage } from '../out/analysis-queue.port';

export abstract class ProcessAnalysisJobUseCase {
  abstract execute(job: AnalysisJobMessage): Promise<void>;
}
