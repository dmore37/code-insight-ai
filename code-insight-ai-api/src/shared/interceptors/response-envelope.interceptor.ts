import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResponse, ok } from '../http/api-response';

/**
 * Envuelve toda respuesta exitosa de un controller en el envelope
 * `{ success: true, data }`, para que el frontend siempre reciba la
 * misma forma de respuesta (ver AllExceptionsFilter para el caso de error).
 *
 * También fuerza el status HTTP a 200, incluso en verbos donde Nest usaría
 * otro código por defecto (ej. 201 en POST), para cumplir la regla de
 * negocio: el status HTTP solo refleja "el servidor respondió", nunca el
 * resultado de negocio (eso vive en `success`/`error` dentro del body).
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const response = context.switchToHttp().getResponse();
    response.status(HttpStatus.OK);
    return next.handle().pipe(map((data) => ok(data)));
  }
}
