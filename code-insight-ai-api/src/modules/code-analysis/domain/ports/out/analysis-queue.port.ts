
export interface AnalysisJobMessage {
  id: string;
  gitUrl?: string;
  zipFilePath?: string;
  zipS3Key?: string;
}

export abstract class AnalysisQueuePort {
  abstract enqueue(job: AnalysisJobMessage): Promise<void>;
}
