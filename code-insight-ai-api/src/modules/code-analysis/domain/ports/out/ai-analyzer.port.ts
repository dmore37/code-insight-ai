import { StaticAnalysisResult } from './static-analyzer.port';
import {
  ArchitectureInference,
  FunctionalAnalysis,
  Findings,
} from '../../entities/analysis-result.entity';

export interface AiAnalysisResult {
  functional: FunctionalAnalysis;
  architecture: ArchitectureInference;
  findings: Findings;
}

export abstract class AiAnalyzerPort {
  abstract analyze(staticResult: StaticAnalysisResult): Promise<AiAnalysisResult>;
}
