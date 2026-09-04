/**
 * Constantes de UI del módulo de análisis, centralizadas para evitar
 * valores "mágicos" dispersos en distintos componentes.
 */

/** Tamaño de página inicial y de cada "cargar más" del historial. */
export const HISTORY_PAGE_SIZE = 20;

/** Intervalo de polling del historial mientras haya registros "processing". */
export const HISTORY_POLLING_INTERVAL_MS = 5000;

/** Intervalo de polling del estado de un análisis recién enviado. */
export const SUBMIT_POLL_INTERVAL_MS = 1500;

/** Tiempo máximo de espera (polling) de un análisis antes de abandonar. */
export const SUBMIT_POLL_TIMEOUT_MS = 60_000;
