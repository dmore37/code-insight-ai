import { AnalysisResult } from './analysis-result.model';

export enum AnalysisStatus {
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}

export enum AnalysisVisibility {
  Public = 'public',
  Private = 'private',
}

export interface AnalysisRecord {
  id: string;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  gitUrl?: string;
  zipFilePath?: string;
  zipS3Key?: string;
  zipHash?: string;
  result?: AnalysisResult;
  errorMessage?: string;
  ownerId?: string;
  visibility?: AnalysisVisibility;
}

