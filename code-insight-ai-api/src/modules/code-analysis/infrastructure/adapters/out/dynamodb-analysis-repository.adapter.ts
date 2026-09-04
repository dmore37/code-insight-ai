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
import { AnalysisRecord } from '../../../domain/entities/analysis-record.entity';

/**
 * Adaptador de salida: persiste el historial de análisis en DynamoDB.
 *
 * Esquema de la tabla:
 * - PK: id (string)
 * - Atributos: status, gitUrl, zipFilePath, result (map, opcional),
 *   errorMessage, createdAt, updatedAt, gsiPk (constante "ALL", usada solo
 *   como partition key del GSI de listado cronológico).
 * - GSI "byCreatedAt": PK=gsiPk (constante "ALL"), SK=createdAt, para poder
 *   listar los análisis más recientes con una sola Query ordenada.
 */
@Injectable()
export class DynamoDbAnalysisRepositoryAdapter implements AnalysisRepositoryPort {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly gsiName: string;
  private static readonly GSI_PK_VALUE = 'ALL';

  constructor(private readonly config: ConfigService) {
    const raw = new DynamoDBClient({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.client = DynamoDBDocumentClient.from(raw, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = this.config.get<string>(
      'DYNAMODB_TABLE_NAME',
      'code-insight-ai-analysis-history',
    );
    this.gsiName = this.config.get<string>(
      'DYNAMODB_GSI_NAME',
      'byCreatedAt',
    );
  }

  async save(record: AnalysisRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          id: record.id,
          gsiPk: DynamoDbAnalysisRepositoryAdapter.GSI_PK_VALUE,
          status: record.status,
          gitUrl: record.gitUrl,
          zipFilePath: record.zipFilePath,
          result: this.toPlainResult(record.result),
          errorMessage: record.errorMessage,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      }),
    );
  }

  /**
   * `AnalysisResult` es una instancia de clase con un campo `createdAt`
   * de tipo `Date`; DynamoDB (marshall) no soporta `Date` nativamente,
   * así que se convierte a un objeto plano con la fecha en ISO string.
   */
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
        ScanIndexForward: false, // más recientes primero
        Limit: limit,
      }),
    );
    return (response.Items ?? []).map((item) => this.toEntity(item));
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
    );
  }
}
