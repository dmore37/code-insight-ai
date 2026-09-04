/**
 * Mensaje encolado para que un worker asíncrono procese el análisis.
 */
export interface AnalysisJobMessage {
  id: string;
  gitUrl?: string;
  zipFilePath?: string;
}

/**
 * Puerto de salida para encolar trabajos de análisis asíncronos
 * (implementado en infraestructura por un adaptador de SQS).
 */
export abstract class AnalysisQueuePort {
  abstract enqueue(job: AnalysisJobMessage): Promise<void>;
}
