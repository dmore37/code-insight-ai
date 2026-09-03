import { Provider } from '@angular/core';
import { AnalysisRepositoryPort } from '../domain/ports/analysis-repository.port';
import { HttpAnalysisRepositoryAdapter } from '../infrastructure/http-analysis-repository.adapter';

/**
 * Wiring de la arquitectura hexagonal en el frontend: conecta el puerto
 * abstracto `AnalysisRepositoryPort` con su implementación concreta
 * `HttpAnalysisRepositoryAdapter`. Se registra en `app.config.ts`.
 */
export const codeAnalysisProviders: Provider[] = [
  { provide: AnalysisRepositoryPort, useClass: HttpAnalysisRepositoryAdapter },
];
