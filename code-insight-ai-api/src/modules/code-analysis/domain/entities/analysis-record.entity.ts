import { AnalysisResult } from './analysis-result.entity';

/**
 * Estado del ciclo de vida de un análisis procesado de forma asíncrona.
 */
export type AnalysisStatus = 'processing' | 'completed' | 'failed';

/**
 * Visibilidad de un registro: "public" (análisis por URL git, visible en
 * el feed general) o "private" (análisis por ZIP, solo visible para su
 * dueño, identificado por `ownerId`).
 */
export type AnalysisVisibility = 'public' | 'private';

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
    public readonly ownerId?: string,
    public readonly visibility: AnalysisVisibility = 'public',
    public readonly zipS3Key?: string,
    /** Hash SHA-256 del contenido del ZIP (calculado en el frontend), usado para cachear resultados y evitar reanalizar el mismo archivo. */
    public readonly zipHash?: string,
  ) {}

  static createProcessing(
    id: string,
    source: {
      gitUrl?: string;
      zipFilePath?: string;
      zipS3Key?: string;
      zipHash?: string;
    },
    ownerId?: string,
  ): AnalysisRecord {
    const now = new Date().toISOString();
    // Público: análisis por URL git (aparece en el feed general).
    // Privado: análisis por ZIP (local o subido a S3), solo visible para
    // su dueño a través del GSI "byOwner".
    const visibility: AnalysisVisibility = source.gitUrl ? 'public' : 'private';
    return new AnalysisRecord(
      id,
      'processing',
      now,
      now,
      source.gitUrl,
      source.zipFilePath,
      undefined,
      undefined,
      ownerId,
      visibility,
      source.zipS3Key,
      source.zipHash,
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
      this.ownerId,
      this.visibility,
      this.zipS3Key,
      this.zipHash,
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
      this.ownerId,
      this.visibility,
      this.zipS3Key,
      this.zipHash,
    );
  }
}

