/**
 * Valores por defecto de recursos de infraestructura (nombres de tabla,
 * GSIs, etc.), usados como fallback por `ConfigService.get(key, default)`
 * cuando la variable de entorno correspondiente no está definida
 * (ej. ejecución local sin `.env` completo). Centralizados aquí para que
 * no queden duplicados entre los distintos adapters de DynamoDB.
 */
export const DEFAULT_DYNAMODB_TABLE_NAME = 'code-insight-ai-analysis-history';
export const DEFAULT_DYNAMODB_GSI_NAME = 'byCreatedAt';
export const DEFAULT_DYNAMODB_GITURL_GSI_NAME = 'byGitUrl';
export const DEFAULT_DYNAMODB_OWNER_GSI_NAME = 'byOwner';
export const DEFAULT_DYNAMODB_ZIPHASH_GSI_NAME = 'byZipHash';
export const DEFAULT_AWS_REGION = 'us-east-1';
