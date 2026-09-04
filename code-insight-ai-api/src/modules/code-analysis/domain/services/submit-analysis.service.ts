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
import { CACHE_TTL_MS } from '../config/business-rules.constants';

/**
 * Caso de uso: encola una solicitud de análisis para procesamiento
 * asíncrono. Crea de inmediato el registro con status "processing" en
 * DynamoDB y publica el trabajo en SQS; el worker asíncrono (consumidor de
 * la cola) se encarga de completar el análisis y actualizar el registro.
 *
 * Caché por gitUrl: si ya existe un análisis "completed" reciente (menos
 * de 1 hora) para la misma URL, se reutiliza tal cual (mismo registro,
 * sin crear uno nuevo ni volver a llamar a Bedrock/SQS). Esto evita
 * repetir análisis costosos para URLs consultadas varias veces seguidas.
 *
 * Caché por zipHash: mismo mecanismo, pero para ZIPs subidos, usando el
 * hash SHA-256 del contenido (calculado en el cliente) como clave, ya
 * que dos subidas del mismo archivo generan keys de S3 distintas
 * (incluyen un UUID), pero el contenido —y por lo tanto el hash— es
 * idéntico.
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
    if (!command.gitUrl && !command.zipFilePath && !command.zipS3Key) {
      throw new MissingRepositorySourceError();
    }

    if (command.gitUrl) {
      const cached = await this.findFreshCached(() =>
        this.analysisRepository.findLatestCompletedByGitUrl(command.gitUrl!),
      );
      if (cached) return cached;
    } else if (command.zipHash) {
      const cached = await this.findFreshCached(() =>
        this.analysisRepository.findLatestCompletedByZipHash(
          command.zipHash!,
        ),
      );
      if (cached) return cached;
    }

    const id = randomUUID();
    const record = AnalysisRecord.createProcessing(
      id,
      command,
      command.ownerId,
    );

    await this.analysisRepository.save(record);

    try {
      await this.analysisQueue.enqueue({
        id,
        gitUrl: command.gitUrl,
        zipFilePath: command.zipFilePath,
        zipS3Key: command.zipS3Key,
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

  /**
   * Solo cuenta como "caché válido" si el análisis "completed" más
   * reciente encontrado por `finder` tiene menos de `CACHE_TTL_MS`; caso
   * contrario (o si no existe ninguno), devuelve null y se ejecuta el
   * flujo normal.
   */
  private async findFreshCached(
    finder: () => Promise<AnalysisRecord | null>,
  ): Promise<AnalysisRecord | null> {
    const cached = await finder();
    if (!cached) return null;

    const ageMs = Date.now() - new Date(cached.createdAt).getTime();
    return ageMs < CACHE_TTL_MS ? cached : null;
  }
}
