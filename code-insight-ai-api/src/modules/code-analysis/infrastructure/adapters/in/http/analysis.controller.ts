import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyzeRepositoryUseCase } from '../../../../domain/ports/in/analyze-repository.use-case';
import { SubmitAnalysisUseCase } from '../../../../domain/ports/in/submit-analysis.use-case';
import { GetAnalysisStatusUseCase } from '../../../../domain/ports/in/get-analysis-status.use-case';
import { ListAnalysisHistoryUseCase } from '../../../../domain/ports/in/list-analysis-history.use-case';
import { GetZipUploadUrlUseCase } from '../../../../domain/ports/in/get-zip-upload-url.use-case';
import { AnalyzeRepositoryRequestDto } from './analyze-repository-request.dto';
import { AnalysisResult } from '../../../../domain/entities/analysis-result.entity';
import { AnalysisRecord } from '../../../../domain/entities/analysis-record.entity';
import { PresignedUpload } from '../../../../domain/ports/out/zip-upload.port';
import { RateLimiterPort } from '../../../../domain/ports/out/rate-limiter.port';
import { RATE_LIMITER_PORT } from '../../../config/tokens';
import {
  UnauthorizedAppError,
  RateLimitExceededError,
} from '../../../../../../shared/errors/app-error';
import { getOwnerId } from './extract-owner-id.util';
import {
  DAILY_LIMIT_PER_USER,
  DAILY_LIMIT_PER_ANONYMOUS_IP,
} from '../../../../domain/config/business-rules.constants';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analyzeRepository: AnalyzeRepositoryUseCase,
    private readonly submitAnalysis: SubmitAnalysisUseCase,
    private readonly getAnalysisStatus: GetAnalysisStatusUseCase,
    private readonly listAnalysisHistory: ListAnalysisHistoryUseCase,
    private readonly getZipUploadUrl: GetZipUploadUrlUseCase,
    @Inject(RATE_LIMITER_PORT) private readonly rateLimiter: RateLimiterPort,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async analyze(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<AnalysisResult> {
    const dto = AnalyzeRepositoryRequestDto.validate(body);
    const ownerId = await this.requireOwnerIdForZip(
      req,
      dto.zipFilePath ?? dto.zipS3Key,
    );
    await this.enforceRateLimit(req, ownerId);
    return this.analyzeRepository.execute({
      gitUrl: dto.gitUrl,
      zipFilePath: dto.zipFilePath,
      zipS3Key: dto.zipS3Key,
    });
  }

  @Post('async')
  async submit(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<AnalysisRecord> {
    const dto = AnalyzeRepositoryRequestDto.validate(body);
    const ownerId = await this.requireOwnerIdForZip(
      req,
      dto.zipFilePath ?? dto.zipS3Key,
    );
    await this.enforceRateLimit(req, ownerId);
    return this.submitAnalysis.execute({
      gitUrl: dto.gitUrl,
      zipFilePath: dto.zipFilePath,
      zipS3Key: dto.zipS3Key,
      zipHash: dto.zipHash,
      ownerId,
    });
  }

  @Post('zip/upload-url')
  async getUploadUrl(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<PresignedUpload> {
    const ownerId = await getOwnerId(req, this.config);
    if (!ownerId) throw new UnauthorizedAppError();

    const fileName =
      typeof body === 'object' && body !== null && 'fileName' in body
        ? String((body as Record<string, unknown>)['fileName'])
        : undefined;
    return this.getZipUploadUrl.execute(ownerId, fileName);
  }

  @Get(':id')
  async getStatus(@Param('id') id: string): Promise<AnalysisRecord> {
    return this.getAnalysisStatus.execute(id);
  }

  @Get()
  async history(
    @Query('limit') limit?: string,
    @Req() req?: Request,
  ): Promise<AnalysisRecord[]> {
    const ownerId = req ? await getOwnerId(req, this.config) : undefined;
    const parsed = limit ? Number(limit) : undefined;
    return this.listAnalysisHistory.execute(parsed, ownerId);
  }

  private async requireOwnerIdForZip(
    req: Request,
    zipSource: string | undefined,
  ): Promise<string | undefined> {
    const ownerId = await getOwnerId(req, this.config);
    if (zipSource && !ownerId) throw new UnauthorizedAppError();
    return ownerId;
  }

  private async enforceRateLimit(
    req: Request,
    ownerId: string | undefined,
  ): Promise<void> {
    const key = ownerId ? `user:${ownerId}` : `ip:${req.ip ?? 'unknown'}`;
    const limit = ownerId
      ? DAILY_LIMIT_PER_USER
      : DAILY_LIMIT_PER_ANONYMOUS_IP;

    const allowed = await this.rateLimiter.tryConsume(key, limit);
    if (!allowed) throw new RateLimitExceededError();
  }
}
