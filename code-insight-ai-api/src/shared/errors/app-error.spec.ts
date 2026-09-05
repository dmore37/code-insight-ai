import {
  AppError,
  ValidationAppError,
  UnauthorizedAppError,
  UnexpectedAppError,
  RateLimitExceededError,
} from './app-error';

describe('GIVEN AppError subclasses', () => {
  describe('GIVEN a ValidationAppError with details', () => {
    it('WHEN a ValidationAppError is created THEN it should expose a stable "VALIDATION_ERROR" code and preserve the message/details', () => {
            const error = new ValidationAppError('Invalid payload', { field: 'gitUrl' });

            expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid payload');
      expect(error.details).toEqual({ field: 'gitUrl' });
      expect(error.name).toBe('ValidationAppError');
    });
  });

  describe('GIVEN an UnauthorizedAppError created without a custom message', () => {
    it('WHEN an UnauthorizedAppError is created without a message THEN it should default to a generic "please sign in" message', () => {
            const error = new UnauthorizedAppError();

            expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message.length).toBeGreaterThan(0);
    });
  });

  describe('GIVEN an UnexpectedAppError', () => {
    it('WHEN an UnexpectedAppError is created THEN it should expose the "UNEXPECTED_ERROR" code', () => {
            const error = new UnexpectedAppError();

            expect(error.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('GIVEN a RateLimitExceededError', () => {
    it('WHEN a RateLimitExceededError is created THEN it should expose the "RATE_LIMIT_EXCEEDED" code', () => {
            const error = new RateLimitExceededError();

            expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
