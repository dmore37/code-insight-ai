import { AnalysisJobMessage } from '../out/analysis-queue.port';

/**
 * Puerto de entrada usado por el worker asíncrono (consumidor de SQS):
 * ejecuta el análisis completo (fetch + static + IA) y persiste el
 * resultado final (completed/failed) en el historial.
 */
export abstract class ProcessAnalysisJobUseCase {
  abstract execute(job: AnalysisJobMessage): Promise<void>;
}
