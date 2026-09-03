export type ArchitecturePattern =
  | 'Monolito'
  | 'MVC'
  | 'Clean Architecture'
  | 'Hexagonal'
  | 'Microservicios'
  | 'N-Capas'
  | 'Indeterminado';

export interface GeneralInfo {
  projectName: string;
  mainLanguage: string;
  mainFramework: string;
  approxFileCount: number;
}

export interface DetectedComponent {
  type:
    | 'Controller'
    | 'Service'
    | 'Repository'
    | 'Model'
    | 'AngularComponent'
    | 'ConsumedApi'
    | 'Other';
  name: string;
  path: string;
}

export interface ArchitectureInference {
  pattern: ArchitecturePattern;
  confidence: number; // 0-1
  evidences: string[];
}

export interface FunctionalAnalysis {
  summary: string;
  technologiesDetected: string[];
}

export interface Findings {
  recommendations: string[];
  risks: string[];
}

/**
 * Entidad raíz del dominio: resultado completo del análisis de un repositorio.
 */
export class AnalysisResult {
  constructor(
    public readonly id: string,
    public readonly general: GeneralInfo,
    public readonly functional: FunctionalAnalysis,
    public readonly architecture: ArchitectureInference,
    public readonly components: DetectedComponent[],
    public readonly findings: Findings,
    public readonly createdAt: Date = new Date(),
  ) {}
}
