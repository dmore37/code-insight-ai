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

/**
 * Adaptador de entrada HTTP. Nótese que no hay try/catch aquí:
 * cualquier error (de validación o del caso de uso) es capturado por el
 * AllExceptionsFilter global, que decide el formato de respuesta.
 *
 * Autenticación mixta por caso de uso:
 * - Analizar por URL git pública NO requiere sesión (información ya
 *   pública; `ownerId` queda undefined y el análisis es visible en el
 *   feed general).
 * - Analizar por ZIP (código propio, potencialmente privado) SÍ requiere
 *   sesión de Cognito válida, para evitar subidas anónimas y poder
 *   asociar el análisis a su dueño real.
 * El token se verifica en el propio backend (`getOwnerId`, vía
 * `aws-jwt-verify`) y no en API Gateway, precisamente porque la decisión
 * de exigir o no login depende del contenido del body, algo que un JWT
 * Authorizer de ruta no puede evaluar.
 */
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

  /** Análisis síncrono: espera el resultado completo antes de responder. */
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

  /**
   * Análisis asíncrono: crea el registro (status "processing"), lo encola
   * en SQS y responde de inmediato con el id para hacer polling.
   */
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

  /** Genera una URL prefirmada de S3 para subir un ZIP directamente (siempre requiere sesión). */
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

  /** Consulta el estado/resultado de un análisis asíncrono por id (no requiere sesión). */
  @Get(':id')
  async getStatus(@Param('id') id: string): Promise<AnalysisRecord> {
    return this.getAnalysisStatus.execute(id);
  }

  /**
   * Lista los análisis más recientes (historial: feed público + los
   * privados del dueño, si hay sesión activa). No requiere sesión: sin
   * ella, simplemente se ve solo el feed público.
   */
  @Get()
  async history(
    @Query('limit') limit?: string,
    @Req() req?: Request,
  ): Promise<AnalysisRecord[]> {
    const ownerId = req ? await getOwnerId(req, this.config) : undefined;
    const parsed = limit ? Number(limit) : undefined;
    return this.listAnalysisHistory.execute(parsed, ownerId);
  }

  /**
   * Si la solicitud incluye un origen ZIP (local o S3), exige sesión
   * activa y devuelve el `ownerId` verificado. Si es solo URL git, no
   * exige nada y devuelve el `ownerId` si lo hay (o undefined).
   */
  private async requireOwnerIdForZip(
    req: Request,
    zipSource: string | undefined,
  ): Promise<string | undefined> {
    const ownerId = await getOwnerId(req, this.config);
    if (zipSource && !ownerId) throw new UnauthorizedAppError();
    return ownerId;
  }

  /**
   * Protege el uso de Bedrock (costoso) de abusos: usuarios autenticados
   * tienen una cuota diaria más generosa (`ownerId` como key); solicitudes
   * anónimas (solo URL git pública) se limitan por IP, más estricta, ya
   * que no hay forma de identificar de forma persistente al solicitante.
   */
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
