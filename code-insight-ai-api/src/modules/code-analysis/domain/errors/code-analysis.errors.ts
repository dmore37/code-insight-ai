import { AppError } from '../../../../shared/errors/app-error';

export class MissingRepositorySourceError extends AppError {
  readonly code = 'MISSING_REPOSITORY_SOURCE';

  constructor() {
    super('Debe proporcionar una URL de repositorio git o un archivo ZIP.');
  }
}

export class RepoFetchError extends AppError {
  readonly code = 'REPO_FETCH_FAILED';

  constructor(reference: string, cause?: unknown) {
    super(
      `No fue posible obtener el repositorio "${reference}". Verifique que la URL sea pública y accesible, o que el ZIP sea válido.`,
      cause instanceof Error ? cause.message : cause,
    );
  }
}

export class StaticAnalysisError extends AppError {
  readonly code = 'STATIC_ANALYSIS_FAILED';

  constructor(cause?: unknown) {
    super(
      'No fue posible analizar la estructura del proyecto.',
      cause instanceof Error ? cause.message : cause,
    );
  }
}

export class AnalysisNotFoundError extends AppError {
  readonly code = 'ANALYSIS_NOT_FOUND';

  constructor(id: string) {
    super(`No se encontró un análisis con id "${id}".`);
  }
}

export class AnalysisQueueError extends AppError {
  readonly code = 'ANALYSIS_QUEUE_FAILED';

  constructor(cause?: unknown) {
    super(
      'No fue posible encolar el análisis para procesamiento asíncrono.',
      cause instanceof Error ? cause.message : cause,
    );
  }
}

export class AiAnalysisError extends AppError {
  readonly code = 'AI_ANALYSIS_FAILED';

  constructor(cause?: unknown) {
    super(
      'No fue posible completar el análisis con IA. Se devolvió un resultado parcial cuando fue posible.',
      cause instanceof Error ? cause.message : cause,
    );
  }
}
