import { of, firstValueFrom } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';
import { CallHandler, ExecutionContext, HttpStatus } from '@nestjs/common';

describe('ResponseEnvelopeInterceptor', () => {
  let interceptor: ResponseEnvelopeInterceptor<unknown>;
  let statusMock: jest.Mock;
  let context: ExecutionContext;

  beforeEach(() => {
    interceptor = new ResponseEnvelopeInterceptor();
    statusMock = jest.fn();
    context = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ExecutionContext;
  });

  describe('given a handler that resolves with a plain payload', () => {
    it('should force HTTP 200 and wrap the payload as a success envelope', async () => {
      // Given
      const handler: CallHandler = { handle: () => of({ id: '123' }) };

      // When
      const result = await firstValueFrom(interceptor.intercept(context, handler));

      // Then
      expect(statusMock).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toEqual({ success: true, data: { id: '123' } });
    });
  });
});
