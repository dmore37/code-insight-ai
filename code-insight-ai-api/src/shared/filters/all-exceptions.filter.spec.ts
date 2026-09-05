import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ValidationAppError } from '../errors/app-error';

describe('GIVEN AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
      }),
    } as unknown as ArgumentsHost;
  });

  describe('GIVEN a domain AppError (e.g. ValidationAppError)', () => {
    it('WHEN catch is called with a ValidationAppError THEN it should respond with HTTP 200 and a failure envelope using the error own code', () => {
            const error = new ValidationAppError('Invalid gitUrl');

            filter.catch(error, host);

            expect(statusMock).toHaveBeenCalledWith(HttpStatus.OK);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid gitUrl', details: undefined },
      });
    });
  });

  describe('GIVEN a plain NestJS HttpException with a string response', () => {
    it('WHEN catch is called with an HttpException THEN it should respond with HTTP 200 and a failure envelope prefixed with "HTTP_"', () => {
            const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

            filter.catch(error, host);

            expect(statusMock).toHaveBeenCalledWith(HttpStatus.OK);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'HTTP_403', message: 'Forbidden', details: undefined },
      });
    });
  });

  describe('GIVEN a NestJS HttpException whose response body has an array of messages', () => {
    it('WHEN catch is called with an array of messages THEN it should join the messages into a single comma-separated string', () => {
            const error = new HttpException(
        { message: ['gitUrl is required', 'zipS3Key is required'] },
        HttpStatus.BAD_REQUEST,
      );

            filter.catch(error, host);

            expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'HTTP_400',
          message: 'gitUrl is required, zipS3Key is required',
          details: undefined,
        },
      });
    });
  });

  describe('GIVEN a completely unexpected error (e.g. a plain Error or AWS SDK exception)', () => {
    it('WHEN catch is called with an unexpected error THEN it should respond with HTTP 200 and the generic "UNEXPECTED_ERROR" code', () => {
            const error = new Error('Something exploded');

            filter.catch(error, host);

            expect(statusMock).toHaveBeenCalledWith(HttpStatus.OK);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: 'Ocurrió un error inesperado al procesar la solicitud.',
          details: undefined,
        },
      });
    });
  });
});
