import {
  AppError,
  ValidationAppError,
  UnauthorizedAppError,
  UnexpectedAppError,
  RateLimitExceededError,
} from './app-error';

describe('AppError subclasses', () => {
  describe('given a ValidationAppError with details', () => {
    it('should expose a stable "VALIDATION_ERROR" code and preserve the message/details', () => {
      // Given / When
      const error = new ValidationAppError('Invalid payload', { field: 'gitUrl' });

      // Then
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid payload');
      expect(error.details).toEqual({ field: 'gitUrl' });
      expect(error.name).toBe('ValidationAppError');
    });
  });

  describe('given an UnauthorizedAppError created without a custom message', () => {
    it('should default to a generic "please sign in" message', () => {
      // Given / When
      const error = new UnauthorizedAppError();

      // Then
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  describe('given an UnexpectedAppError', () => {
    it('should expose the "UNEXPECTED_ERROR" code', () => {
      // Given / When
      const error = new UnexpectedAppError();

      // Then
      expect(error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('given a RateLimitExceededError', () => {
    it('should expose the "RATE_LIMIT_EXCEEDED" code', () => {
      // Given / When
      const error = new RateLimitExceededError();

      // Then
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
