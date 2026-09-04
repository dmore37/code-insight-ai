import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AnalyzeRepositoryUseCase } from '../../../../domain/ports/in/analyze-repository.use-case';
import { SubmitAnalysisUseCase } from '../../../../domain/ports/in/submit-analysis.use-case';
import { GetAnalysisStatusUseCase } from '../../../../domain/ports/in/get-analysis-status.use-case';
import { ListAnalysisHistoryUseCase } from '../../../../domain/ports/in/list-analysis-history.use-case';
import { AnalyzeRepositoryRequestDto } from './analyze-repository-request.dto';
import { AnalysisResult } from '../../../../domain/entities/analysis-result.entity';
import { AnalysisRecord } from '../../../../domain/entities/analysis-record.entity';

/**
 * Adaptador de entrada HTTP. Nótese que no hay try/catch aquí:
 * cualquier error (de validación o del caso de uso) es capturado por el
 * AllExceptionsFilter global, que decide el formato de respuesta.
 */
@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analyzeRepository: AnalyzeRepositoryUseCase,
    private readonly submitAnalysis: SubmitAnalysisUseCase,
    private readonly getAnalysisStatus: GetAnalysisStatusUseCase,
    private readonly listAnalysisHistory: ListAnalysisHistoryUseCase,
  ) {}

  /** Análisis síncrono: espera el resultado completo antes de responder. */
  @Post()
  async analyze(@Body() body: unknown): Promise<AnalysisResult> {
    const dto = AnalyzeRepositoryRequestDto.validate(body);
    return this.analyzeRepository.execute({
      gitUrl: dto.gitUrl,
      zipFilePath: dto.zipFilePath,
    });
  }

  /**
   * Análisis asíncrono: crea el registro (status "processing"), lo encola
   * en SQS y responde de inmediato con el id para hacer polling.
   */
  @Post('async')
  async submit(@Body() body: unknown): Promise<AnalysisRecord> {
    const dto = AnalyzeRepositoryRequestDto.validate(body);
    return this.submitAnalysis.execute({
      gitUrl: dto.gitUrl,
      zipFilePath: dto.zipFilePath,
    });
  }

  /** Consulta el estado/resultado de un análisis asíncrono por id. */
  @Get(':id')
  async getStatus(@Param('id') id: string): Promise<AnalysisRecord> {
    return this.getAnalysisStatus.execute(id);
  }

  /** Lista los análisis más recientes (historial). */
  @Get()
  async history(@Query('limit') limit?: string): Promise<AnalysisRecord[]> {
    const parsed = limit ? Number(limit) : undefined;
    return this.listAnalysisHistory.execute(parsed);
  }
}
