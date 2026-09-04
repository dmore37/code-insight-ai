export enum ArchitecturePattern {
  Monolith = 'Monolito',
  Mvc = 'MVC',
  CleanArchitecture = 'Clean Architecture',
  Hexagonal = 'Hexagonal',
  Microservices = 'Microservicios',
  NLayers = 'N-Capas',
  Undetermined = 'Indeterminado',
}

export interface GeneralInfo {
  projectName: string;
  mainLanguage: string;
  mainFramework: string;
  approxFileCount: number;
}

export enum DetectedComponentType {
  Controller = 'Controller',
  Service = 'Service',
  Repository = 'Repository',
  Model = 'Model',
  AngularComponent = 'AngularComponent',
  ConsumedApi = 'ConsumedApi',
  Other = 'Other',
}

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
