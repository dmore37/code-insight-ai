import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '../errors/app-error';
import { fail } from '../http/api-response';

/**
 * Filtro global de excepciones.
 *
 * Regla de negocio pedida explícitamente: mientras el backend logre
 * responder, el status HTTP debe ser 200. El detalle del error (código,
 * mensaje, detalles) viaja dentro del body con `success: false`.
 *
 * - AppError (y subclases): error de dominio/negocio controlado -> 200 + body.
 * - HttpException de Nest (ej. validación de rutas, 404 de Nest, etc.) -> 200 + body,
 *   reusando el mensaje/código que Nest generó.
 * - Cualquier otro error no controlado -> 200 + body con code UNEXPECTED_ERROR,
 *   sin filtrar detalles internos sensibles (stack trace) al cliente, pero
 *   sí registrados en el log del servidor para diagnóstico.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppError) {
      this.logger.warn(`[${exception.code}] ${exception.message}`);
      response
        .status(HttpStatus.OK)
        .json(fail(exception.code, exception.message, exception.details));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as any)?.message ?? exception.message);

      this.logger.warn(`[HTTP_${status}] ${JSON.stringify(message)}`);
      response
        .status(HttpStatus.OK)
        .json(fail(`HTTP_${status}`, Array.isArray(message) ? message.join(', ') : message));
      return;
    }

    this.logger.error(
      'Error no controlado',
      exception instanceof Error ? exception.stack : String(exception),
    );
    response
      .status(HttpStatus.OK)
      .json(fail('UNEXPECTED_ERROR', 'Ocurrió un error inesperado al procesar la solicitud.'));
  }
}
