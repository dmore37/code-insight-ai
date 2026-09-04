export interface PresignedUpload {
  /** URL prefirmada de S3 (PUT) hacia la que el navegador sube el ZIP directamente. */
  uploadUrl: string;
  /** Key del objeto en el bucket, a usar luego como `zipS3Key` al enviar el análisis. */
  key: string;
}

/**
 * Puerto de salida: genera URLs prefirmadas de S3 para que el navegador
 * suba un ZIP directamente al bucket de uploads, sin pasar por
 * Lambda/API Gateway (evita el límite de payload de 10MB).
 */
export abstract class ZipUploadPort {
  /**
   * `fileName`: nombre original del archivo elegido por el usuario (ej.
   * "mi-proyecto.zip"). Se embebe en el key de S3 para poder mostrarlo
   * luego como nombre del proyecto en el resumen del análisis.
   */
  abstract generateUploadUrl(
    ownerId?: string,
    fileName?: string,
  ): Promise<PresignedUpload>;
}
