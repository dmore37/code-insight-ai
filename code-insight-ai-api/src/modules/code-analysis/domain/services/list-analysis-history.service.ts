import { Inject, Injectable } from '@nestjs/common';
import { ListAnalysisHistoryUseCase } from '../ports/in/list-analysis-history.use-case';
import { AnalysisRepositoryPort } from '../ports/out/analysis-repository.port';
import { AnalysisRecord } from '../entities/analysis-record.entity';
import { ANALYSIS_REPOSITORY_PORT } from '../../infrastructure/config/tokens';

const DEFAULT_LIMIT = 20;

@Injectable()
export class ListAnalysisHistoryService implements ListAnalysisHistoryUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(limit: number = DEFAULT_LIMIT): Promise<AnalysisRecord[]> {
    return this.analysisRepository.findRecent(limit);
  }
}
