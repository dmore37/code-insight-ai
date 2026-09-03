/**
 * Envelope estándar de las respuestas de la API (debe ser un espejo exacto
 * del `ApiResponse<T>` del backend). El status HTTP siempre es 200; el
 * resultado real (éxito/error) viaja en el campo `success`.
 */
export interface ApiErrorInfo {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorInfo };
