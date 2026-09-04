/**
 * El key de S3 de un ZIP subido tiene el formato
 * `uploads/{owner}/{uuid}__{nombreOriginal}.zip`. Esta función extrae el
 * nombre original legible, para no mostrarle al usuario el UUID interno
 * ni la ruta completa del bucket.
 *
 * Si el key no sigue ese formato (por compatibilidad con keys antiguos
 * generados antes de este cambio), se devuelve el key completo tal cual.
 */
export function extractZipDisplayName(zipS3Key: string): string {
  const fileName = zipS3Key.split('/').pop() ?? zipS3Key;
  const separatorIndex = fileName.indexOf('__');
  return separatorIndex >= 0 ? fileName.slice(separatorIndex + 2) : fileName;
}
