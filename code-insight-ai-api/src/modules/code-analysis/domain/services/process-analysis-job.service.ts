import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProcessAnalysisJobUseCase } from '../ports/in/process-analysis-job.use-case';
import { AnalyzeRepositoryUseCase } from '../ports/in/analyze-repository.use-case';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisJobMessage } from '../ports/out/analysis-queue.port';
import { ANALYSIS_REPOSITORY_PORT } from '../../infrastructure/config/tokens';

/**
 * Caso de uso ejecutado por el worker asíncrono (consumidor de SQS):
 * reutiliza el mismo `AnalyzeRepositoryUseCase` síncrono (fetch + static +
 * IA) y, al terminar, persiste el resultado (completed) o el error
 * (failed) en el historial de DynamoDB.
 */
@Injectable()
export class ProcessAnalysisJobService implements ProcessAnalysisJobUseCase {
  private readonly logger = new Logger(ProcessAnalysisJobService.name);

  constructor(
    private readonly analyzeRepository: AnalyzeRepositoryUseCase,
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(job: AnalysisJobMessage): Promise<void> {
    const existing = await this.analysisRepository.findById(job.id);
    if (!existing) {
      this.logger.warn(`No se encontró el registro ${job.id}, se omite.`);
      return;
    }

    try {
      const result = await this.analyzeRepository.execute({
        gitUrl: job.gitUrl,
        zipFilePath: job.zipFilePath,
        zipS3Key: job.zipS3Key,
      });

      const idResult = { ...result, id: job.id } as typeof result;
      await this.analysisRepository.save(existing.withCompleted(idResult));
    } catch (error) {
      this.logger.error(
        `Falló el análisis asíncrono ${job.id}: ${error}`,
      );
      const message = error instanceof Error ? error.message : String(error);
      await this.analysisRepository.save(existing.withFailed(message));
    }
  }
}
