import { RepositorySource } from '../../../domain/entities/repository-source.entity';
import {
  DetectedComponent,
  GeneralInfo,
} from '../../../domain/entities/analysis-result.entity';

export interface StaticAnalysisEvidence {
  description: string;
  filePath: string;
  snippet?: string;
}

export interface StaticAnalysisResult {
  general: GeneralInfo;
  components: DetectedComponent[];
  evidences: StaticAnalysisEvidence[];

  fileTreeSummary: string;

  keyFileExcerpts: { path: string; content: string }[];
}

export abstract class StaticAnalyzerPort {
  abstract analyze(source: RepositorySource): Promise<StaticAnalysisResult>;
}
