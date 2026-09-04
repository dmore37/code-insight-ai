import { ok, fail } from './api-response';

describe('api-response helpers', () => {
  describe('given a successful payload', () => {
    it('ok() should wrap it as { success: true, data }', () => {
      // Given
      const payload = { id: '123' };

      // When
      const response = ok(payload);

      // Then
      expect(response).toEqual({ success: true, data: payload });
    });
  });

  describe('given an error code, message and optional details', () => {
    it('fail() should wrap them as { success: false, error }', () => {
      // Given / When
      const response = fail('VALIDATION_ERROR', 'Invalid input', { field: 'gitUrl' });

      // Then
      expect(response).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: { field: 'gitUrl' },
        },
      });
    });
  });

  describe('given an error without details', () => {
    it('fail() should leave "details" as undefined', () => {
      // Given / When
      const response = fail('NOT_FOUND', 'Missing resource');

      // Then
      expect(response.success).toBe(false);
      expect((response as any).error.details).toBeUndefined();
    });
  });
});
