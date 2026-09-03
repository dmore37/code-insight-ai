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

/**
 * Puerto de salida: enriquece el análisis estático usando un modelo de IA
 * (Bedrock/Claude u otro proveedor) para generar resumen funcional,
 * inferencia de arquitectura, recomendaciones y riesgos.
 */
export abstract class AiAnalyzerPort {
  abstract analyze(staticResult: StaticAnalysisResult): Promise<AiAnalysisResult>;
}
