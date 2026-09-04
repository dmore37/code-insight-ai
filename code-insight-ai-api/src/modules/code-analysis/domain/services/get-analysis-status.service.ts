import { Inject, Injectable } from '@nestjs/common';
import { GetAnalysisStatusUseCase } from '../ports/in/get-analysis-status.use-case';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisRecord } from '../entities/analysis-record.entity';
import { ANALYSIS_REPOSITORY_PORT } from '../../infrastructure/config/tokens';
import { AnalysisNotFoundError } from '../errors/code-analysis.errors';

@Injectable()
export class GetAnalysisStatusService implements GetAnalysisStatusUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(id: string): Promise<AnalysisRecord> {
    const record = await this.analysisRepository.findById(id);
    if (!record) {
      throw new AnalysisNotFoundError(id);
    }
    return record;
  }
}
