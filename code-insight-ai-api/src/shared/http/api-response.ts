/**
 * Envelope estándar de todas las respuestas HTTP de la API.
 *
 * Decisión de arquitectura: la API SIEMPRE responde HTTP 200 mientras el
 * servidor logre procesar la petición (no haya caído/colgado). El resultado
 * de negocio (éxito o error) viaja DENTRO del body mediante `success`.
 * Esto da control total al frontend sobre cómo interpretar y mostrar cada
 * caso, sin depender de la semántica HTTP para errores de negocio.
 *
 * Solo se usará un status HTTP distinto de 200 en casos de infraestructura
 * que Nest no puede evitar (ej. 404 de ruta inexistente, payload demasiado
 * grande, etc.), nunca para errores de negocio/dominio.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function ok<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data };
}

export function fail(
  code: string,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  return { success: false, error: { code, message, details } };
}
