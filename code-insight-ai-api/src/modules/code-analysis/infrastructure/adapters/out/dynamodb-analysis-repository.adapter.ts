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
 *   como partition key del GSI de listado cronológico), expiresAt (epoch
 *   segundos, usado por el TTL nativo de DynamoDB para borrado automático).
 * - GSI "byCreatedAt": PK=gsiPk (constante "ALL"), SK=createdAt, para poder
 *   listar los análisis más recientes con una sola Query ordenada.
 * - GSI "byGitUrl": PK=gitUrl, SK=createdAt, para poder buscar el análisis
 *   completado más reciente de una URL (caché de resultados) sin Scan.
 *   Es un índice disperso: los registros sin `gitUrl` (análisis por ZIP)
 *   simplemente no aparecen en él.
 */
@Injectable()
export class DynamoDbAnalysisRepositoryAdapter implements AnalysisRepositoryPort {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly gsiName: string;
  private readonly gitUrlGsiName: string;
  private static readonly GSI_PK_VALUE = 'ALL';
  private static readonly RETENTION_DAYS = 90;

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
    this.gitUrlGsiName = this.config.get<string>(
      'DYNAMODB_GITURL_GSI_NAME',
      'byGitUrl',
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
          expiresAt: this.computeExpiresAt(record.createdAt),
        },
      }),
    );
  }

  /**
   * TTL nativo de DynamoDB: epoch en segundos a partir del cual el
   * registro puede ser borrado automáticamente por AWS (gratis, sin
   * consumir capacidad de escritura). No afecta el caché por gitUrl,
   * que se decide en el dominio comparando `createdAt`.
   */
  private computeExpiresAt(createdAt: string): number {
    const createdMs = new Date(createdAt).getTime();
    const retentionMs =
      DynamoDbAnalysisRepositoryAdapter.RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return Math.floor((createdMs + retentionMs) / 1000);
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

  /**
   * Busca el análisis "completed" más reciente para una URL git dada,
   * usando el GSI "byGitUrl" (Query, no Scan). Se piden hasta 10 items
   * más recientes de esa URL (pueden incluir "processing"/"failed") y se
   * filtra en memoria el primero "completed", ya que un FilterExpression
   * combinado con Limit se aplicaría antes del filtro y podría descartar
   * el resultado que buscamos.
   */
  async findLatestCompletedByGitUrl(
    gitUrl: string,
  ): Promise<AnalysisRecord | null> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.gitUrlGsiName,
        KeyConditionExpression: 'gitUrl = :u',
        ExpressionAttributeValues: { ':u': gitUrl },
        ScanIndexForward: false, // más recientes primero
        Limit: 10,
      }),
    );
    const completedItem = (response.Items ?? []).find(
      (item) => item.status === 'completed',
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
    );
  }
}
