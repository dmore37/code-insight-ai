import { Body, Controller, Post } from '@nestjs/common';
import { AnalyzeRepositoryUseCase } from '../../../../domain/ports/in/analyze-repository.use-case';
import { AnalyzeRepositoryRequestDto } from './analyze-repository-request.dto';
import { AnalysisResult } from '../../../../domain/entities/analysis-result.entity';

/**
 * Adaptador de entrada HTTP. Nótese que no hay try/catch aquí:
 * cualquier error (de validación o del caso de uso) es capturado por el
 * AllExceptionsFilter global, que decide el formato de respuesta.
 */
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analyzeRepository: AnalyzeRepositoryUseCase) {}

  @Post()
  async analyze(@Body() body: unknown): Promise<AnalysisResult> {
    const dto = AnalyzeRepositoryRequestDto.validate(body);
    return this.analyzeRepository.execute({
      gitUrl: dto.gitUrl,
      zipFilePath: dto.zipFilePath,
    });
  }
}
