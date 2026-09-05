import { ok, fail } from './api-response';

describe('GIVEN api-response helpers', () => {
  describe('GIVEN a successful payload', () => {
    it('WHEN ok() is called THEN it should wrap it as { success: true, data }', () => {
            const payload = { id: '123' };

            const response = ok(payload);

            expect(response).toEqual({ success: true, data: payload });
    });
  });

  describe('GIVEN an error code, message and optional details', () => {
    it('WHEN fail() is called THEN it should wrap them as { success: false, error }', () => {
            const response = fail('VALIDATION_ERROR', 'Invalid input', { field: 'gitUrl' });

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

  describe('GIVEN an error without details', () => {
    it('WHEN fail() is called without details THEN it should leave "details" as undefined', () => {
            const response = fail('NOT_FOUND', 'Missing resource');

            expect(response.success).toBe(false);
      expect((response as any).error.details).toBeUndefined();
    });
  });
});
