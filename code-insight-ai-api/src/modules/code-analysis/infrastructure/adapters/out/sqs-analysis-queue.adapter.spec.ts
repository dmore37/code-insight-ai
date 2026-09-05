import { SqsAnalysisQueueAdapter } from './sqs-analysis-queue.adapter';
import { ConfigService } from '@nestjs/config';
import { SendMessageCommand } from '@aws-sdk/client-sqs';

describe('GIVEN SqsAnalysisQueueAdapter', () => {
  let send: jest.Mock;
  let adapter: SqsAnalysisQueueAdapter;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'SQS_QUEUE_URL' ? 'https://sqs.example.com/queue' : fallback,
      ),
    } as unknown as ConfigService;
    adapter = new SqsAnalysisQueueAdapter(config);
    send = jest.fn().mockResolvedValue({});
    (adapter as unknown as { client: { send: jest.Mock } }).client = { send };
  });

  describe('GIVEN a job message with a gitUrl', () => {
    it('WHEN enqueue is called THEN it should send it to the configured queue URL as a JSON string body', async () => {
            const job = { id: 'job-1', gitUrl: 'https://github.com/owner/repo.git' };

            await adapter.enqueue(job);

            expect(send).toHaveBeenCalledTimes(1);
      const commandArg = send.mock.calls[0][0];
      expect(commandArg).toBeInstanceOf(SendMessageCommand);
      expect(commandArg.input.QueueUrl).toBe('https://sqs.example.com/queue');
      expect(JSON.parse(commandArg.input.MessageBody)).toEqual(job);
    });
  });
});
