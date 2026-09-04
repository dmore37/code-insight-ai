/**
 * El key de S3 de un ZIP subido tiene el formato
 * `uploads/{owner}/{uuid}__{nombreOriginal}.zip`. Esta función extrae el
 * nombre original legible para mostrarlo en el historial, en vez del key
 * completo (con el UUID interno y la ruta del bucket).
 */
export function extractZipDisplayName(zipS3Key: string): string {
  const fileName = zipS3Key.split('/').pop() ?? zipS3Key;
  const separatorIndex = fileName.indexOf('__');
  return separatorIndex >= 0 ? fileName.slice(separatorIndex + 2) : fileName;
}

/**
 * Algunos mensajes de error (guardados en el historial antes de que este
 * fix existiera, o generados por rutas de código que aún no usan
 * `extractZipDisplayName`) incluyen el key completo de S3 embebido en el
 * texto, ej: `uploads/{owner}/{uuid}__{nombre}.zip`. Esta función busca
 * esos patrones dentro de cualquier string y los reemplaza por el nombre
 * legible, para que tanto registros nuevos como antiguos se vean bien sin
 * necesidad de migrar datos ni redeployar el backend.
 */
export function sanitizeZipReferences(message: string | undefined | null): string {
  if (!message) return '';
  return message.replace(/uploads\/[^\s"'.]+(?:\.[^\s"'.]+)*\.zip/g, (match) =>
    extractZipDisplayName(match),
  );
}
