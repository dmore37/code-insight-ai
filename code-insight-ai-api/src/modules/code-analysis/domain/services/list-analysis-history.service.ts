import { Inject, Injectable } from '@nestjs/common';
import { ListAnalysisHistoryUseCase } from '../ports/in/list-analysis-history.use-case';
import {
  AnalysisRepositoryPort,
  AnalysisHistoryPage,
} from '../ports/out/analysis-repository.port';
import { ANALYSIS_REPOSITORY_PORT } from '../../infrastructure/config/tokens';

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class ListAnalysisHistoryService implements ListAnalysisHistoryUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
  ) {}

  async execute(
    pageSize: number = DEFAULT_PAGE_SIZE,
    ownerId?: string,
    cursor?: string,
  ): Promise<AnalysisHistoryPage> {
    return this.analysisRepository.findRecentPublicAndByOwnerPage(
      ownerId,
      pageSize,
      cursor,
    );
  }
}
