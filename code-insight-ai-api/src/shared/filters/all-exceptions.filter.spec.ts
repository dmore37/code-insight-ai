import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ValidationAppError } from '../errors/app-error';

describe('AllExceptionsFilter', () => {
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

  describe('given a domain AppError (e.g. ValidationAppError)', () => {
    it('should respond with HTTP 200 and a failure envelope using the error own code', () => {
      // Given
      const error = new ValidationAppError('Invalid gitUrl');

      // When
      filter.catch(error, host);

      // Then
      expect(statusMock).toHaveBeenCalledWith(HttpStatus.OK);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid gitUrl', details: undefined },
      });
    });
  });

  describe('given a plain NestJS HttpException with a string response', () => {
    it('should respond with HTTP 200 and a failure envelope prefixed with "HTTP_"', () => {
      // Given
      const error = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      // When
      filter.catch(error, host);

      // Then
      expect(statusMock).toHaveBeenCalledWith(HttpStatus.OK);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: { code: 'HTTP_403', message: 'Forbidden', details: undefined },
      });
    });
  });

  describe('given a NestJS HttpException whose response body has an array of messages', () => {
    it('should join the messages into a single comma-separated string', () => {
      // Given
      const error = new HttpException(
        { message: ['gitUrl is required', 'zipS3Key is required'] },
        HttpStatus.BAD_REQUEST,
      );

      // When
      filter.catch(error, host);

      // Then
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

  describe('given a completely unexpected error (e.g. a plain Error or AWS SDK exception)', () => {
    it('should respond with HTTP 200 and the generic "UNEXPECTED_ERROR" code', () => {
      // Given
      const error = new Error('Something exploded');

      // When
      filter.catch(error, host);

      // Then
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
