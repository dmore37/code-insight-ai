import { RepositorySource } from '../../entities/repository-source.entity';
import {
  DetectedComponent,
  GeneralInfo,
} from '../../entities/analysis-result.entity';

export interface StaticAnalysisEvidence {
  description: string;
  filePath: string;
  snippet?: string;
}

export interface StaticAnalysisResult {
  general: GeneralInfo;
  components: DetectedComponent[];
  evidences: StaticAnalysisEvidence[];
  /** Árbol de directorios resumido, útil como contexto para la IA */
  fileTreeSummary: string;
  /** Extractos de archivos clave (main, controllers, etc.) para la IA */
  keyFileExcerpts: { path: string; content: string }[];
}

/**
 * Puerto de salida: analiza estáticamente el código en disco mediante
 * heurísticas (sin IA) para detectar lenguaje, framework y componentes.
 */
export abstract class StaticAnalyzerPort {
  abstract analyze(source: RepositorySource): Promise<StaticAnalysisResult>;
}
