import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { RateLimiterPort } from '../../../domain/ports/out/rate-limiter.port';
import {
  DEFAULT_AWS_REGION,
  DEFAULT_DYNAMODB_TABLE_NAME,
} from '../../config/defaults';

@Injectable()
export class DynamoDbRateLimiterAdapter implements RateLimiterPort {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(private readonly config: ConfigService) {
    const raw = new DynamoDBClient({
      region: this.config.get<string>('AWS_REGION', DEFAULT_AWS_REGION),
    });
    this.client = DynamoDBDocumentClient.from(raw, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = this.config.get<string>(
      'DYNAMODB_TABLE_NAME',
      DEFAULT_DYNAMODB_TABLE_NAME,
    );
  }

  async tryConsume(key: string, limit: number): Promise<boolean> {
    const today = new Date().toISOString().slice(0, 10);
    const id = `RATE#${key}#${today}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60;

    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { id },
          UpdateExpression:
            'ADD #count :one SET expiresAt = if_not_exists(expiresAt, :expiresAt)',
          ConditionExpression:
            'attribute_not_exists(#count) OR #count < :limit',
          ExpressionAttributeNames: { '#count': 'count' },
          ExpressionAttributeValues: {
            ':one': 1,
            ':limit': limit,
            ':expiresAt': expiresAt,
          },
        }),
      );
      return true;
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return false;
      throw err;
    }
  }
}
