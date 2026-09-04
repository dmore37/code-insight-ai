

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

export type DetectedComponentType =
  | 'Controller'
  | 'Service'
  | 'Repository'
  | 'Model'
  | 'AngularComponent'
  | 'ConsumedApi'
  | 'Other';

export interface DetectedComponent {
  type: DetectedComponentType;
  name: string;
  path: string;
}

export interface ArchitectureInference {
  pattern: ArchitecturePattern;
  confidence: number;
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

export interface AnalysisResult {
  id: string;
  general: GeneralInfo;
  functional: FunctionalAnalysis;
  architecture: ArchitectureInference;
  components: DetectedComponent[];
  findings: Findings;
  createdAt: string;
}
