import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SubmitAnalysisUseCase } from '../ports/in/submit-analysis.use-case';
import { AnalyzeRepositoryCommand } from '../ports/in/analyze-repository.use-case';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisQueuePort } from '../ports/out/analysis-queue.port';
import { AnalysisRecord } from '../entities/analysis-record.entity';
import {
  ANALYSIS_REPOSITORY_PORT,
  ANALYSIS_QUEUE_PORT,
} from '../../infrastructure/config/tokens';
import { MissingRepositorySourceError, AnalysisQueueError } from '../errors/code-analysis.errors';

/**
 * Caso de uso: encola una solicitud de análisis para procesamiento
 * asíncrono. Crea de inmediato el registro con status "processing" en
 * DynamoDB y publica el trabajo en SQS; el worker asíncrono (consumidor de
 * la cola) se encarga de completar el análisis y actualizar el registro.
 */
@Injectable()
export class SubmitAnalysisService implements SubmitAnalysisUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Inject(ANALYSIS_QUEUE_PORT)
    private readonly analysisQueue: AnalysisQueuePort,
  ) {}

  async execute(command: AnalyzeRepositoryCommand): Promise<AnalysisRecord> {
    if (!command.gitUrl && !command.zipFilePath) {
      throw new MissingRepositorySourceError();
    }

    const id = randomUUID();
    const record = AnalysisRecord.createProcessing(id, command);

    await this.analysisRepository.save(record);

    try {
      await this.analysisQueue.enqueue({
        id,
        gitUrl: command.gitUrl,
        zipFilePath: command.zipFilePath,
      });
    } catch (cause) {
      const failedRecord = record.withFailed(
        'No fue posible encolar el análisis.',
      );
      await this.analysisRepository.save(failedRecord);
      throw new AnalysisQueueError(cause);
    }

    return record;
  }
}
