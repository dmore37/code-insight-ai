import { DynamoDbAnalysisRepositoryAdapter } from './dynamodb-analysis-repository.adapter';
import { ConfigService } from '@nestjs/config';
import { PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AnalysisRecord, AnalysisStatus, AnalysisVisibility } from '../../../domain/entities/analysis-record.entity';

describe('DynamoDbAnalysisRepositoryAdapter', () => {
  let send: jest.Mock;
  let adapter: DynamoDbAnalysisRepositoryAdapter;

  beforeEach(() => {
    const config = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    } as unknown as ConfigService;
    adapter = new DynamoDbAnalysisRepositoryAdapter(config);
    send = jest.fn();
    (adapter as unknown as { client: { send: jest.Mock } }).client = { send };
  });

  describe('given a public record (analyzed by gitUrl)', () => {
    it('should save it with gsiPk="ALL" so it appears in the public feed GSI', async () => {
      // Given
      send.mockResolvedValue({});
      const record = AnalysisRecord.createProcessing(
        'id-1',
        { gitUrl: 'https://github.com/owner/repo.git' },
      );

      // When
      await adapter.save(record);

      // Then
      const commandArg = send.mock.calls[0][0];
      expect(commandArg).toBeInstanceOf(PutCommand);
      expect(commandArg.input.Item.gsiPk).toBe('ALL');
      expect(commandArg.input.Item.visibility).toBe(AnalysisVisibility.Public);
    });
  });

  describe('given a private record (analyzed by ZIP)', () => {
    it('should save it without gsiPk so it never leaks into the public feed', async () => {
      // Given
      send.mockResolvedValue({});
      const record = AnalysisRecord.createProcessing(
        'id-2',
        { zipS3Key: 'uploads/owner-1/key.zip' },
        'owner-1',
      );

      // When
      await adapter.save(record);

      // Then
      const commandArg = send.mock.calls[0][0];
      expect(commandArg.input.Item.gsiPk).toBeUndefined();
      expect(commandArg.input.Item.visibility).toBe(AnalysisVisibility.Private);
    });
  });

  describe('given an existing record id', () => {
    it('findById should map the raw DynamoDB item back into an AnalysisRecord', async () => {
      // Given
      send.mockResolvedValue({
        Item: {
          id: 'id-3',
          status: AnalysisStatus.Completed,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          gitUrl: 'https://github.com/owner/repo.git',
        },
      });

      // When
      const record = await adapter.findById('id-3');

      // Then
      expect(send.mock.calls[0][0]).toBeInstanceOf(GetCommand);
      expect(record?.id).toBe('id-3');
      expect(record?.status).toBe(AnalysisStatus.Completed);
      expect(record?.visibility).toBe(AnalysisVisibility.Public);
    });
  });

  describe('given no record exists for the requested id', () => {
    it('findById should return null', async () => {
      // Given
      send.mockResolvedValue({});

      // When
      const record = await adapter.findById('missing-id');

      // Then
      expect(record).toBeNull();
    });
  });

  describe('given multiple items for a gitUrl with mixed statuses', () => {
    it('findLatestCompletedByGitUrl should pick the first "completed" one and ignore others', async () => {
      // Given
      send.mockResolvedValue({
        Items: [
          { id: 'processing-id', status: AnalysisStatus.Processing, createdAt: '2024-01-02', updatedAt: '2024-01-02' },
          { id: 'completed-id', status: AnalysisStatus.Completed, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        ],
      });

      // When
      const record = await adapter.findLatestCompletedByGitUrl(
        'https://github.com/owner/repo.git',
      );

      // Then
      expect(send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
      expect(record?.id).toBe('completed-id');
    });
  });

  describe('given no completed items exist for a gitUrl', () => {
    it('findLatestCompletedByGitUrl should return null', async () => {
      // Given
      send.mockResolvedValue({
        Items: [{ id: 'processing-id', status: AnalysisStatus.Processing, createdAt: '2024-01-01', updatedAt: '2024-01-01' }],
      });

      // When
      const record = await adapter.findLatestCompletedByGitUrl(
        'https://github.com/owner/repo.git',
      );

      // Then
      expect(record).toBeNull();
    });
  });

  describe('given multiple items for a zipHash with mixed statuses', () => {
    it('findLatestCompletedByZipHash should pick the first "completed" one', async () => {
      // Given
      send.mockResolvedValue({
        Items: [
          { id: 'completed-zip-id', status: AnalysisStatus.Completed, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        ],
      });

      // When
      const record = await adapter.findLatestCompletedByZipHash('abc123hash');

      // Then
      expect(record?.id).toBe('completed-zip-id');
    });
  });

  describe('given a recent list request without an ownerId', () => {
    it('findRecentPublicAndByOwner should only query the public feed', async () => {
      // Given
      send.mockResolvedValue({
        Items: [{ id: 'public-1', status: AnalysisStatus.Completed, createdAt: '2024-01-01', updatedAt: '2024-01-01' }],
      });

      // When
      const records = await adapter.findRecentPublicAndByOwner(undefined, 10);

      // Then
      expect(send).toHaveBeenCalledTimes(1);
      expect(records).toHaveLength(1);
    });
  });

  describe('given a recent list request with an ownerId', () => {
    it('findRecentPublicAndByOwner should merge public and owner items, deduplicated by id, sorted by createdAt desc', async () => {
      // Given: first call returns the public feed, second call returns the owner-specific items
      send
        .mockResolvedValueOnce({
          Items: [{ id: 'public-1', status: AnalysisStatus.Completed, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' }],
        })
        .mockResolvedValueOnce({
          Items: [
            { id: 'public-1', status: AnalysisStatus.Completed, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
            { id: 'private-1', status: AnalysisStatus.Completed, createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z', ownerId: 'owner-1' },
          ],
        });

      // When
      const records = await adapter.findRecentPublicAndByOwner('owner-1', 10);

      // Then
      expect(send).toHaveBeenCalledTimes(2);
      expect(records.map((r) => r.id)).toEqual(['private-1', 'public-1']);
    });
  });
});
