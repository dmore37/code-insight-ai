import { AnalysisResult } from './analysis-result.entity';

export enum AnalysisStatus {
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export enum AnalysisVisibility {
  Public = 'public',
  Private = 'private',
}

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
    public readonly visibility: AnalysisVisibility = AnalysisVisibility.Public,
    public readonly zipS3Key?: string,

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

    const visibility: AnalysisVisibility = source.gitUrl
      ? AnalysisVisibility.Public
      : AnalysisVisibility.Private;
    return new AnalysisRecord(
      id,
      AnalysisStatus.Processing,
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
      AnalysisStatus.Completed,
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
      AnalysisStatus.Failed,
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

