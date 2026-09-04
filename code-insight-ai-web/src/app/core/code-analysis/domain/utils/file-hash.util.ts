/**
 * Calcula el hash SHA-256 (hex) del contenido de un archivo usando la
 * Web Crypto API nativa del navegador (sin dependencias extra). Se usa
 * para el caché de resultados por ZIP: dos subidas del mismo archivo
 * generan keys de S3 distintas (incluyen un UUID), pero el hash del
 * contenido es idéntico, así que el backend puede reutilizar un
 * análisis "completed" reciente en vez de reprocesar.
 */
export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
