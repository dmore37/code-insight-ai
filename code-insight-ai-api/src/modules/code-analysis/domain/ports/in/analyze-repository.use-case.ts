import { AnalysisResult } from '../../entities/analysis-result.entity';

export interface AnalyzeRepositoryCommand {

  gitUrl?: string;

  zipFilePath?: string;

  zipS3Key?: string;

  zipHash?: string;

  ownerId?: string;

  /**
   * Clave e identificador del límite diario de análisis a aplicar SOLO si
   * este comando termina creando un job nuevo (cache miss). Si el
   * resultado se sirve desde caché (misma URL/ZIP analizado hace poco),
   * no debe consumir cuota. Opcionales porque el endpoint síncrono
   * (`AnalyzeRepositoryUseCase`) no los necesita: ese siempre hace
   * trabajo real y su rate limit se aplica antes, en el controller.
   */
  rateLimitKey?: string;

  rateLimitMax?: number;
}

export abstract class AnalyzeRepositoryUseCase {
  abstract execute(command: AnalyzeRepositoryCommand): Promise<AnalysisResult>;
}

