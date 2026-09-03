import { AppError } from '../../../../shared/errors/app-error';

/** El comando de entrada no trae ni URL git ni ruta de ZIP */
export class MissingRepositorySourceError extends AppError {
  readonly code = 'MISSING_REPOSITORY_SOURCE';

  constructor() {
    super('Debe proporcionar una URL de repositorio git o un archivo ZIP.');
  }
}

/** La URL git recibida no es válida o no es pública/accesible */
export class InvalidGitUrlError extends AppError {
  readonly code = 'INVALID_GIT_URL';

  constructor(gitUrl: string) {
    super(`La URL git proporcionada no es válida: "${gitUrl}".`);
  }
}

/** Falló el clonado del repositorio (red, repo privado, no existe, etc.) */
export class RepoFetchError extends AppError {
  readonly code = 'REPO_FETCH_FAILED';

  constructor(reference: string, cause?: unknown) {
    super(
      `No fue posible obtener el repositorio "${reference}". Verifique que la URL sea pública y accesible, o que el ZIP sea válido.`,
      cause instanceof Error ? cause.message : cause,
    );
  }
}

/** Falló el análisis estático del código ya descargado */
export class StaticAnalysisError extends AppError {
  readonly code = 'STATIC_ANALYSIS_FAILED';

  constructor(cause?: unknown) {
    super(
      'No fue posible analizar la estructura del proyecto.',
      cause instanceof Error ? cause.message : cause,
    );
  }
}

/** Falló la etapa de análisis con IA (Bedrock u otro proveedor) */
export class AiAnalysisError extends AppError {
  readonly code = 'AI_ANALYSIS_FAILED';

  constructor(cause?: unknown) {
    super(
      'No fue posible completar el análisis con IA. Se devolvió un resultado parcial cuando fue posible.',
      cause instanceof Error ? cause.message : cause,
    );
  }
}
