import { AnalysisResult } from './analysis-result.entity';

/**
 * Estado del ciclo de vida de un análisis procesado de forma asíncrona.
 */
export type AnalysisStatus = 'processing' | 'completed' | 'failed';

/**
 * Registro persistido en DynamoDB que representa el estado (y, cuando
 * corresponde, el resultado) de una solicitud de análisis asíncrona.
 *
 * Se crea con status "processing" en el momento en que se encola el
 * trabajo en SQS, y se actualiza a "completed" (con `result`) o "failed"
 * (con `errorMessage`) cuando el worker asíncrono termina.
 */
export class AnalysisRecord {
  constructor(
    public readonly id: string,
    public readonly status: AnalysisStatus,
    public readonly createdAt: string,
    public readonly updatedAt: string,
    public readonly gitUrl?: string,
    public readonly zipFilePath?: string,
    public readonly result?: AnalysisResult,
    public readonly errorMessage?: string,
  ) {}

  static createProcessing(
    id: string,
    source: { gitUrl?: string; zipFilePath?: string },
  ): AnalysisRecord {
    const now = new Date().toISOString();
    return new AnalysisRecord(
      id,
      'processing',
      now,
      now,
      source.gitUrl,
      source.zipFilePath,
    );
  }

  withCompleted(result: AnalysisResult): AnalysisRecord {
    return new AnalysisRecord(
      this.id,
      'completed',
      this.createdAt,
      new Date().toISOString(),
      this.gitUrl,
      this.zipFilePath,
      result,
      undefined,
    );
  }

  withFailed(errorMessage: string): AnalysisRecord {
    return new AnalysisRecord(
      this.id,
      'failed',
      this.createdAt,
      new Date().toISOString(),
      this.gitUrl,
      this.zipFilePath,
      undefined,
      errorMessage,
    );
  }
}
