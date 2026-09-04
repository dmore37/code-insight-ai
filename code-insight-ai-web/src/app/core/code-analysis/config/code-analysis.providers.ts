import { Provider } from '@angular/core';
import { AnalysisRepositoryPort } from '../domain/ports/analysis-repository.port';
import { HttpAnalysisRepositoryAdapter } from '../infrastructure/http-analysis-repository.adapter';
import { AnalysisHistoryPort } from '../domain/ports/analysis-history.port';
import { HttpAnalysisHistoryAdapter } from '../infrastructure/http-analysis-history.adapter';

/**
 * Wiring de la arquitectura hexagonal en el frontend: conecta cada puerto
 * abstracto con su implementación concreta. Se registra en `app.config.ts`.
 */
export const codeAnalysisProviders: Provider[] = [
  { provide: AnalysisRepositoryPort, useClass: HttpAnalysisRepositoryAdapter },
  { provide: AnalysisHistoryPort, useClass: HttpAnalysisHistoryAdapter },
];
