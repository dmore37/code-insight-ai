import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  AnalysisQueuePort,
  AnalysisJobMessage,
} from '../../../domain/ports/out/analysis-queue.port';
import { DEFAULT_AWS_REGION } from '../../config/defaults';

@Injectable()
export class SqsAnalysisQueueAdapter implements AnalysisQueuePort {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly config: ConfigService) {
    this.client = new SQSClient({
      region: this.config.get<string>('AWS_REGION', DEFAULT_AWS_REGION),
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
