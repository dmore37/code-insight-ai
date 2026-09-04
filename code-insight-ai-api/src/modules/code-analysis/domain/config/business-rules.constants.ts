/**
 * Reglas de negocio del módulo de análisis, centralizadas en un único
 * lugar para evitar constantes "mágicas" dispersas en services/adapters.
 */

/** Cuota diaria de análisis por usuario autenticado (key: `user:{ownerId}`). */
export const DAILY_LIMIT_PER_USER = 20;

/** Cuota diaria (más estricta) por IP para solicitudes anónimas (key: `ip:{ip}`), solo URL git pública. */
export const DAILY_LIMIT_PER_ANONYMOUS_IP = 5;

/**
 * Ventana de reutilización del caché de resultados (por gitUrl o por
 * zipHash): si existe un análisis "completed" más reciente que esta
 * ventana, se reutiliza en vez de volver a analizar.
 */
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Días de retención de un registro de análisis en DynamoDB antes de que
 * el TTL nativo lo borre automáticamente.
 */
export const RETENTION_DAYS = 90;

/** Vigencia de una URL prefirmada de S3 para subir un ZIP. */
export const UPLOAD_URL_TTL_SECONDS = 5 * 60; // 5 minutos
