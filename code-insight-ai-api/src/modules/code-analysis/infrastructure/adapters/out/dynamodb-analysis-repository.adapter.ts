import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { AnalysisRepositoryPort } from '../../../domain/ports/out/analysis-repository.port';
import {
  AnalysisRecord,
  AnalysisStatus,
  AnalysisVisibility,
} from '../../../domain/entities/analysis-record.entity';
import { RETENTION_DAYS } from '../../../domain/config/business-rules.constants';
import {
  DEFAULT_AWS_REGION,
  DEFAULT_DYNAMODB_TABLE_NAME,
  DEFAULT_DYNAMODB_GSI_NAME,
  DEFAULT_DYNAMODB_GITURL_GSI_NAME,
  DEFAULT_DYNAMODB_OWNER_GSI_NAME,
  DEFAULT_DYNAMODB_ZIPHASH_GSI_NAME,
} from '../../config/defaults';

@Injectable()
export class DynamoDbAnalysisRepositoryAdapter implements AnalysisRepositoryPort {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly gsiName: string;
  private readonly gitUrlGsiName: string;
  private readonly ownerGsiName: string;
  private readonly zipHashGsiName: string;
  private static readonly GSI_PK_VALUE = 'ALL';
  private static readonly RETENTION_DAYS = RETENTION_DAYS;

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
    this.gsiName = this.config.get<string>(
      'DYNAMODB_GSI_NAME',
      DEFAULT_DYNAMODB_GSI_NAME,
    );
    this.gitUrlGsiName = this.config.get<string>(
      'DYNAMODB_GITURL_GSI_NAME',
      DEFAULT_DYNAMODB_GITURL_GSI_NAME,
    );
    this.ownerGsiName = this.config.get<string>(
      'DYNAMODB_OWNER_GSI_NAME',
      DEFAULT_DYNAMODB_OWNER_GSI_NAME,
    );
    this.zipHashGsiName = this.config.get<string>(
      'DYNAMODB_ZIPHASH_GSI_NAME',
      DEFAULT_DYNAMODB_ZIPHASH_GSI_NAME,
    );
  }

  async save(record: AnalysisRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          id: record.id,

          gsiPk:
            record.visibility === AnalysisVisibility.Public
              ? DynamoDbAnalysisRepositoryAdapter.GSI_PK_VALUE
              : undefined,
          status: record.status,
          gitUrl: record.gitUrl,
          zipFilePath: record.zipFilePath,
          zipS3Key: record.zipS3Key,
          zipHash: record.zipHash,
          ownerId: record.ownerId,
          visibility: record.visibility,
          result: this.toPlainResult(record.result),
          errorMessage: record.errorMessage,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          expiresAt: this.computeExpiresAt(record.createdAt),
        },
      }),
    );
  }

  private computeExpiresAt(createdAt: string): number {
    const createdMs = new Date(createdAt).getTime();
    const retentionMs =
      DynamoDbAnalysisRepositoryAdapter.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return Math.floor((createdMs + retentionMs) / 1000);
  }

  private toPlainResult(
    result: AnalysisRecord['result'],
  ): Record<string, unknown> | undefined {
    if (!result) return undefined;
    return { ...result, createdAt: result.createdAt.toISOString() };
  }

  async findById(id: string): Promise<AnalysisRecord | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { id },
      }),
    );
    if (!response.Item) return null;
    return this.toEntity(response.Item);
  }

  async findRecent(limit: number): Promise<AnalysisRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.gsiName,
        KeyConditionExpression: 'gsiPk = :pk',
        ExpressionAttributeValues: {
          ':pk': DynamoDbAnalysisRepositoryAdapter.GSI_PK_VALUE,
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (response.Items ?? []).map((item) => this.toEntity(item));
  }

  async findLatestCompletedByGitUrl(
    gitUrl: string,
  ): Promise<AnalysisRecord | null> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.gitUrlGsiName,
        KeyConditionExpression: 'gitUrl = :u',
        ExpressionAttributeValues: { ':u': gitUrl },
        ScanIndexForward: false,
        Limit: 10,
      }),
    );
    const completedItem = (response.Items ?? []).find(
      (item) => item.status === AnalysisStatus.Completed,
    );
    return completedItem ? this.toEntity(completedItem) : null;
  }

  private toEntity(item: Record<string, any>): AnalysisRecord {
    return new AnalysisRecord(
      item.id,
      item.status,
      item.createdAt,
      item.updatedAt,
      item.gitUrl,
      item.zipFilePath,
      item.result,
      item.errorMessage,
      item.ownerId,
      item.visibility ?? AnalysisVisibility.Public,
      item.zipS3Key,
      item.zipHash,
    );
  }

  async findLatestCompletedByZipHash(
    zipHash: string,
  ): Promise<AnalysisRecord | null> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.zipHashGsiName,
        KeyConditionExpression: 'zipHash = :h',
        ExpressionAttributeValues: { ':h': zipHash },
        ScanIndexForward: false,
        Limit: 10,
      }),
    );
    const completedItem = (response.Items ?? []).find(
      (item) => item.status === AnalysisStatus.Completed,
    );
    return completedItem ? this.toEntity(completedItem) : null;
  }

  async findRecentPublicAndByOwner(
    ownerId: string | undefined,
    limit: number,
  ): Promise<AnalysisRecord[]> {
    const publicItems = await this.findRecent(limit);

    if (!ownerId) return publicItems;

    const ownerResponse = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.ownerGsiName,
        KeyConditionExpression: 'ownerId = :o',
        ExpressionAttributeValues: { ':o': ownerId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    const ownerItems = (ownerResponse.Items ?? []).map((item) =>
      this.toEntity(item),
    );

    const merged = new Map<string, AnalysisRecord>();
    for (const item of [...publicItems, ...ownerItems]) {
      merged.set(item.id, item);
    }

    return [...merged.values()]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }
}
