import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { AnalysisRepositoryPort, AnalysisHistoryPage } from '../../../domain/ports/out/analysis-repository.port';
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

  // ============================================================
  // Paginación con cursor de `findRecentPublicAndByOwner`.
  //
  // El feed que se muestra es la fusión (merge) de dos queries
  // independientes de DynamoDB, ordenadas de forma global por
  // `createdAt` desc. Un `LastEvaluatedKey` de una sola query no
  // alcanza para paginar ese resultado combinado (el "próximo" ítem
  // global puede venir de cualquiera de las dos fuentes). La solución es
  // un "k-way merge" clásico: se mantiene, por cada fuente, un pequeño
  // buffer de look-ahead con al menos `pageSize` ítems (mientras la
  // fuente no esté agotada). Ese estado (LastEvaluatedKey + buffer +
  // flag "agotada" de cada fuente) se serializa como JSON y se codifica
  // en base64 para viajar de ida y vuelta en el `cursor` opaco que ve el
  // cliente, sin necesidad de guardar nada en el servidor entre
  // requests (mantiene el endpoint stateless).
  //
  // El buffer solo guarda {id, createdAt} (no el registro completo) para
  // no inflar el tamaño del cursor con el contenido de `result`; el
  // contenido completo de los ítems de la página se resuelve al final
  // con un único BatchGetItem por los ids que realmente se muestran.
  // ============================================================

  private static readonly CURSOR_VERSION = 1;

  async findRecentPublicAndByOwnerPage(
    ownerId: string | undefined,
    pageSize: number,
    cursor?: string,
  ): Promise<AnalysisHistoryPage> {
    const state = this.decodeCursor(cursor);

    const pubRefill = await this.refillBuffer(
      state.pubBuf,
      state.pubLek,
      state.pubDone,
      pageSize,
      (limit, lek) =>
        this.client.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: this.gsiName,
            KeyConditionExpression: 'gsiPk = :pk',
            ExpressionAttributeValues: {
              ':pk': DynamoDbAnalysisRepositoryAdapter.GSI_PK_VALUE,
            },
            ScanIndexForward: false,
            Limit: limit,
            ExclusiveStartKey: lek,
          }),
        ),
    );

    const ownRefill = ownerId
      ? await this.refillBuffer(
          state.ownBuf,
          state.ownLek,
          state.ownDone,
          pageSize,
          (limit, lek) =>
            this.client.send(
              new QueryCommand({
                TableName: this.tableName,
                IndexName: this.ownerGsiName,
                KeyConditionExpression: 'ownerId = :o',
                ExpressionAttributeValues: { ':o': ownerId },
                ScanIndexForward: false,
                Limit: limit,
                ExclusiveStartKey: lek,
              }),
            ),
        )
      : { buf: [], lek: undefined, done: true };

    const combined = new Map<string, CursorBufEntry>();
    for (const entry of pubRefill.buf) combined.set(entry.id, entry);
    for (const entry of ownRefill.buf) {
      if (!combined.has(entry.id)) combined.set(entry.id, entry);
    }

    const sorted = [...combined.values()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    );
    const pageEntries = sorted.slice(0, pageSize);
    const pageIds = new Set(pageEntries.map((e) => e.id));

    const nextState: CursorState = {
      pubLek: pubRefill.lek,
      pubDone: pubRefill.done,
      pubBuf: pubRefill.buf.filter((e) => !pageIds.has(e.id)),
      ownLek: ownRefill.lek,
      ownDone: ownRefill.done,
      ownBuf: ownRefill.buf.filter((e) => !pageIds.has(e.id)),
    };

    const hasMore =
      nextState.pubBuf.length > 0 ||
      nextState.ownBuf.length > 0 ||
      !nextState.pubDone ||
      !nextState.ownDone;

    const items = await this.batchGetOrdered(pageEntries.map((e) => e.id));

    return {
      items,
      nextCursor: hasMore ? this.encodeCursor(nextState) : undefined,
    };
  }

  private async refillBuffer(
    initialBuf: CursorBufEntry[],
    initialLek: Record<string, unknown> | undefined,
    initialDone: boolean,
    pageSize: number,
    query: (
      limit: number,
      lek?: Record<string, unknown>,
    ) => Promise<{ Items?: Record<string, any>[]; LastEvaluatedKey?: Record<string, any> }>,
  ): Promise<{ buf: CursorBufEntry[]; lek?: Record<string, unknown>; done: boolean }> {
    const buf = [...initialBuf];
    let lek = initialLek;
    let done = initialDone;

    while (buf.length < pageSize && !done) {
      const need = pageSize - buf.length;
      const response = await query(need, lek);
      const items = response.Items ?? [];
      for (const item of items) {
        buf.push({ id: item.id, createdAt: item.createdAt });
      }
      lek = response.LastEvaluatedKey;
      if (!lek) done = true;
      if (items.length === 0) break;
    }

    return { buf, lek, done };
  }

  private async batchGetOrdered(ids: string[]): Promise<AnalysisRecord[]> {
    if (ids.length === 0) return [];

    const response = await this.client.send(
      new BatchGetCommand({
        RequestItems: {
          [this.tableName]: { Keys: ids.map((id) => ({ id })) },
        },
      }),
    );
    const rawItems = response.Responses?.[this.tableName] ?? [];
    const byId = new Map(rawItems.map((item) => [item.id as string, item]));

    return ids
      .map((id) => byId.get(id))
      .filter((item): item is Record<string, any> => item !== undefined)
      .map((item) => this.toEntity(item));
  }

  private decodeCursor(cursor: string | undefined): CursorState {
    const empty: CursorState = {
      pubLek: undefined,
      pubDone: false,
      pubBuf: [],
      ownLek: undefined,
      ownDone: false,
      ownBuf: [],
    };
    if (!cursor) return empty;

    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf-8'),
      );
      if (decoded.v !== DynamoDbAnalysisRepositoryAdapter.CURSOR_VERSION) {
        return empty;
      }
      return {
        pubLek: decoded.pubLek,
        pubDone: Boolean(decoded.pubDone),
        pubBuf: decoded.pubBuf ?? [],
        ownLek: decoded.ownLek,
        ownDone: Boolean(decoded.ownDone),
        ownBuf: decoded.ownBuf ?? [],
      };
    } catch {
      return empty;
    }
  }

  private encodeCursor(state: CursorState): string {
    const payload = {
      v: DynamoDbAnalysisRepositoryAdapter.CURSOR_VERSION,
      ...state,
    };
    return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  }
}

interface CursorBufEntry {
  id: string;
  createdAt: string;
}

interface CursorState {
  pubLek?: Record<string, unknown>;
  pubDone: boolean;
  pubBuf: CursorBufEntry[];
  ownLek?: Record<string, unknown>;
  ownDone: boolean;
  ownBuf: CursorBufEntry[];
}
