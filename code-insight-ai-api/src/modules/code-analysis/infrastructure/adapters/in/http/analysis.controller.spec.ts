import { AnalysisController } from './analysis.controller';
import { AnalyzeRepositoryUseCase } from '../../../../application/ports/in/analyze-repository.use-case';
import { SubmitAnalysisUseCase } from '../../../../application/ports/in/submit-analysis.use-case';
import { GetAnalysisStatusUseCase } from '../../../../application/ports/in/get-analysis-status.use-case';
import { ListAnalysisHistoryUseCase } from '../../../../application/ports/in/list-analysis-history.use-case';
import { GetZipUploadUrlUseCase } from '../../../../application/ports/in/get-zip-upload-url.use-case';
import { RateLimiterPort } from '../../../../application/ports/out/rate-limiter.port';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  UnauthorizedAppError,
  RateLimitExceededError,
} from '../../../../../../shared/errors/app-error';
import { getOwnerId } from './extract-owner-id.util';

jest.mock('./extract-owner-id.util', () => ({ getOwnerId: jest.fn() }));

const getOwnerIdMock = getOwnerId as jest.Mock;

function buildRequest(ip = '1.2.3.4'): Request {
  return { ip, headers: {} } as unknown as Request;
}

describe('GIVEN AnalysisController', () => {
  let analyzeRepository: jest.Mocked<AnalyzeRepositoryUseCase>;
  let submitAnalysis: jest.Mocked<SubmitAnalysisUseCase>;
  let getAnalysisStatus: jest.Mocked<GetAnalysisStatusUseCase>;
  let listAnalysisHistory: jest.Mocked<ListAnalysisHistoryUseCase>;
  let getZipUploadUrl: jest.Mocked<GetZipUploadUrlUseCase>;
  let rateLimiter: jest.Mocked<RateLimiterPort>;
  let controller: AnalysisController;

  beforeEach(() => {
    getOwnerIdMock.mockReset();
    analyzeRepository = { execute: jest.fn() };
    submitAnalysis = { execute: jest.fn() };
    getAnalysisStatus = { execute: jest.fn() };
    listAnalysisHistory = { execute: jest.fn() };
    getZipUploadUrl = { execute: jest.fn() };
    rateLimiter = { tryConsume: jest.fn() };

    controller = new AnalysisController(
      analyzeRepository,
      submitAnalysis,
      getAnalysisStatus,
      listAnalysisHistory,
      getZipUploadUrl,
      rateLimiter,
      {} as ConfigService,
    );
  });

  describe('WHEN an anonymous request analyzes a public git URL', () => {
    it('WHEN analyze is called anonymously THEN it should not require authentication and should rate-limit by IP', async () => {
            getOwnerIdMock.mockResolvedValue(undefined);
      rateLimiter.tryConsume.mockResolvedValue(true);
      analyzeRepository.execute.mockResolvedValue({} as any);

            await controller.analyze(
        { gitUrl: 'https://github.com/owner/repo.git' },
        buildRequest('9.9.9.9'),
      );

            expect(rateLimiter.tryConsume).toHaveBeenCalledWith('ip:9.9.9.9', 5);
      expect(analyzeRepository.execute).toHaveBeenCalled();
    });
  });

  describe('WHEN a request analyzes a ZIP without an authenticated ownerId', () => {
    it('WHEN analyze is called without ownerId THEN it should throw UnauthorizedAppError before touching the rate limiter or the use case', async () => {
            getOwnerIdMock.mockResolvedValue(undefined);

            await expect(
        controller.analyze({ zipFilePath: '/tmp/file.zip' }, buildRequest()),
      ).rejects.toBeInstanceOf(UnauthorizedAppError);
      expect(rateLimiter.tryConsume).not.toHaveBeenCalled();
      expect(analyzeRepository.execute).not.toHaveBeenCalled();
    });
  });

  describe('WHEN an authenticated request submits a ZIP analysis', () => {
    it('WHEN submit is called with an authenticated ownerId THEN it should rate-limit by "user:{ownerId}" using the higher authenticated quota', async () => {
            getOwnerIdMock.mockResolvedValue('owner-1');
      rateLimiter.tryConsume.mockResolvedValue(true);
      submitAnalysis.execute.mockResolvedValue({} as any);

            await controller.submit({ zipS3Key: 'uploads/owner-1/key.zip' }, buildRequest());

            expect(submitAnalysis.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'owner-1',
          rateLimitKey: 'user:owner-1',
          rateLimitMax: 20,
        }),
      );
    });
  });

  describe('WHEN the rate limiter denies the request', () => {
    it('WHEN tryConsume resolves false THEN it should throw RateLimitExceededError and never call the use case', async () => {
            getOwnerIdMock.mockResolvedValue(undefined);
      rateLimiter.tryConsume.mockResolvedValue(false);

            await expect(
        controller.analyze({ gitUrl: 'https://github.com/owner/repo.git' }, buildRequest()),
      ).rejects.toBeInstanceOf(RateLimitExceededError);
      expect(analyzeRepository.execute).not.toHaveBeenCalled();
    });
  });

  describe('WHEN a request asks for a presigned ZIP upload URL without authentication', () => {
    it('WHEN getUploadUrl is called without ownerId THEN it should throw UnauthorizedAppError', async () => {
            getOwnerIdMock.mockResolvedValue(undefined);

            await expect(
        controller.getUploadUrl({ fileName: 'file.zip' }, buildRequest()),
      ).rejects.toBeInstanceOf(UnauthorizedAppError);
    });
  });

  describe('WHEN an authenticated request asks for a presigned ZIP upload URL with a fileName', () => {
    it('WHEN getUploadUrl is called with ownerId and fileName THEN it should forward the ownerId and fileName to the use case', async () => {
            getOwnerIdMock.mockResolvedValue('owner-1');
      getZipUploadUrl.execute.mockResolvedValue({
        uploadUrl: 'https://s3.example.com/presigned',
        key: 'uploads/owner-1/uuid__file.zip',
      });

            const result = await controller.getUploadUrl(
        { fileName: 'file.zip' },
        buildRequest(),
      );

            expect(getZipUploadUrl.execute).toHaveBeenCalledWith('owner-1', 'file.zip');
      expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    });
  });

  describe('WHEN a request asks for the analysis history without a "limit" query param', () => {
    it('WHEN history is called without limit THEN it should pass "undefined" as the limit so the service applies its own default', async () => {
            getOwnerIdMock.mockResolvedValue(undefined);
      listAnalysisHistory.execute.mockResolvedValue({ items: [] });

            await controller.history(undefined, undefined, buildRequest());

            expect(listAnalysisHistory.execute).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
  });

  describe('WHEN a request asks for the analysis history with an explicit "limit" query param', () => {
    it('WHEN history is called with a limit string THEN it should parse it into a number before forwarding it to the use case', async () => {
            getOwnerIdMock.mockResolvedValue('owner-1');
      listAnalysisHistory.execute.mockResolvedValue({ items: [] });

            await controller.history('5', undefined, buildRequest());

            expect(listAnalysisHistory.execute).toHaveBeenCalledWith(5, 'owner-1', undefined);
    });
  });

  describe('WHEN a request asks for the status of an existing analysis id', () => {
    it('WHEN getStatus is called with an id THEN it should delegate directly to GetAnalysisStatusUseCase', async () => {
            getAnalysisStatus.execute.mockResolvedValue({} as any);

            await controller.getStatus('abc-123');

            expect(getAnalysisStatus.execute).toHaveBeenCalledWith('abc-123');
    });
  });
});
