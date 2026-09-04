/**
 * Tokens de inyección de dependencias para los puertos de salida.
 * Nest no puede inyectar por clase abstracta directamente sin un token,
 * así que usamos estos símbolos para desacoplar dominio de infraestructura.
 */
export const REPO_FETCHER_PORT = Symbol('REPO_FETCHER_PORT');
export const STATIC_ANALYZER_PORT = Symbol('STATIC_ANALYZER_PORT');
export const AI_ANALYZER_PORT = Symbol('AI_ANALYZER_PORT');
export const ANALYSIS_REPOSITORY_PORT = Symbol('ANALYSIS_REPOSITORY_PORT');
export const ANALYSIS_QUEUE_PORT = Symbol('ANALYSIS_QUEUE_PORT');
export const ZIP_UPLOAD_PORT = Symbol('ZIP_UPLOAD_PORT');
export const RATE_LIMITER_PORT = Symbol('RATE_LIMITER_PORT');
