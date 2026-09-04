import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  AnalysisQueuePort,
  AnalysisJobMessage,
} from '../../../domain/ports/out/analysis-queue.port';

/**
 * Adaptador de salida: publica trabajos de análisis en una cola SQS para
 * que sean procesados de forma asíncrona por un consumidor (event source
 * mapping de Lambda).
 */
@Injectable()
export class SqsAnalysisQueueAdapter implements AnalysisQueuePort {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly config: ConfigService) {
    this.client = new SQSClient({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.queueUrl = this.config.get<string>('SQS_QUEUE_URL', '');
  }

  async enqueue(job: AnalysisJobMessage): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(job),
      }),
    );
  }
}
