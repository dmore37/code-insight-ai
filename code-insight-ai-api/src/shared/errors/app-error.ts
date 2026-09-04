
export abstract class AppError extends Error {

  abstract readonly code: string;

  public readonly details?: unknown;

  protected constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ValidationAppError extends AppError {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class UnauthorizedAppError extends AppError {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Debes iniciar sesión para realizar esta acción.') {
    super(message);
  }
}

export class UnexpectedAppError extends AppError {
  readonly code = 'UNEXPECTED_ERROR';

  constructor(message = 'Ocurrió un error inesperado.', details?: unknown) {
    super(message, details);
  }
}

export class RateLimitExceededError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(
    message = 'Alcanzaste el límite diario de análisis. Intenta nuevamente mañana.',
  ) {
    super(message);
  }
}
