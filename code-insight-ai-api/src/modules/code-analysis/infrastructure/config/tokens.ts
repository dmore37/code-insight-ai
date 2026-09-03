/**
 * Tokens de inyección de dependencias para los puertos de salida.
 * Nest no puede inyectar por clase abstracta directamente sin un token,
 * así que usamos estos símbolos para desacoplar dominio de infraestructura.
 */
export const REPO_FETCHER_PORT = Symbol('REPO_FETCHER_PORT');
export const STATIC_ANALYZER_PORT = Symbol('STATIC_ANALYZER_PORT');
export const AI_ANALYZER_PORT = Symbol('AI_ANALYZER_PORT');
