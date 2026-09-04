/**
 * Error base de la aplicación. Todos los errores de dominio/infraestructura
 * que queremos controlar (para no devolver un 500 genérico) deben extender
 * esta clase, indicando un código estable y legible para el cliente.
 */
export abstract class AppError extends Error {
  /** Código corto y estable, útil para el frontend (ej. "REPO_FETCH_FAILED") */
  abstract readonly code: string;

  /** Detalles adicionales opcionales (no sensibles) para depuración en el cliente */
  public readonly details?: unknown;

  protected constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

/** Error por datos de entrada inválidos (equivalente conceptual a un 400) */
export class ValidationAppError extends AppError {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

/** Error por falta de autenticación (equivalente conceptual a un 401) */
export class UnauthorizedAppError extends AppError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Debes iniciar sesión para realizar esta acción.') {
    super(message);
  }
}

/** Error inesperado no controlado explícitamente (equivalente conceptual a un 500) */
export class UnexpectedAppError extends AppError {
  readonly code = 'UNEXPECTED_ERROR';

  constructor(message = 'Ocurrió un error inesperado.', details?: unknown) {
    super(message, details);
  }
}

/** Se superó la cuota diaria de análisis permitida (equivalente conceptual a un 429) */
export class RateLimitExceededError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(
    message = 'Alcanzaste el límite diario de análisis. Intenta nuevamente mañana.',
  ) {
    super(message);
  }
}
