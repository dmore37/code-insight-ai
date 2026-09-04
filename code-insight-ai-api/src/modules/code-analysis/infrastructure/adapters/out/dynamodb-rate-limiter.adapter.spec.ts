import { DynamoDbRateLimiterAdapter } from './dynamodb-rate-limiter.adapter';
import { ConfigService } from '@nestjs/config';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

describe('DynamoDbRateLimiterAdapter', () => {
  let send: jest.Mock;
  let adapter: DynamoDbRateLimiterAdapter;

  beforeEach(() => {
    send = jest.fn();
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => fallback),
    } as unknown as ConfigService;

    adapter = new DynamoDbRateLimiterAdapter(config);
    // Replace the internal DynamoDBDocumentClient with a stub whose `send` we control.
    (adapter as unknown as { client: { send: jest.Mock } }).client = { send };
  });

  describe('when the counter for today is below the limit', () => {
    it('should return true and issue an atomic UpdateCommand with ADD + ConditionExpression', async () => {
      // Given: the underlying UpdateCommand resolves successfully
      send.mockResolvedValue({});

      // When
      const allowed = await adapter.tryConsume('user:abc', 20);

      // Then
      expect(allowed).toBe(true);
      expect(send).toHaveBeenCalledTimes(1);
      const commandArg = send.mock.calls[0][0];
      expect(commandArg).toBeInstanceOf(UpdateCommand);
      expect(commandArg.input.Key.id).toMatch(/^RATE#user:abc#\d{4}-\d{2}-\d{2}$/);
      expect(commandArg.input.ExpressionAttributeValues[':limit']).toBe(20);
    });
  });

  describe('when the counter for today has already reached the limit', () => {
    it('should return false without throwing', async () => {
      // Given: DynamoDB rejects the conditional update (limit already reached)
      send.mockRejectedValue(
        new ConditionalCheckFailedException({
          message: 'Condition failed',
          $metadata: {},
        }),
      );

      // When
      const allowed = await adapter.tryConsume('ip:1.2.3.4', 5);

      // Then
      expect(allowed).toBe(false);
    });
  });

  describe('when DynamoDB fails for a reason other than the condition check', () => {
    it('should propagate the original error', async () => {
      // Given: a generic/unexpected failure (e.g. network error)
      const unexpected = new Error('network error');
      send.mockRejectedValue(unexpected);

      // When / Then
      await expect(adapter.tryConsume('user:abc', 20)).rejects.toBe(unexpected);
    });
  });
});
