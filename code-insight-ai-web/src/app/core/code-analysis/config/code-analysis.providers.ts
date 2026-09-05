import { Provider } from '@angular/core';
import { AnalysisRepositoryPort } from '../application/ports/analysis-repository.port';
import { HttpAnalysisRepositoryAdapter } from '../infrastructure/http-analysis-repository.adapter';
import { AnalysisHistoryPort } from '../application/ports/analysis-history.port';
import { HttpAnalysisHistoryAdapter } from '../infrastructure/http-analysis-history.adapter';

export const codeAnalysisProviders: Provider[] = [
  { provide: AnalysisRepositoryPort, useClass: HttpAnalysisRepositoryAdapter },
  { provide: AnalysisHistoryPort, useClass: HttpAnalysisHistoryAdapter },
];
