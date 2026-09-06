export enum RepoUploadErrorMessage {
  MissingGitUrl = 'Debes ingresar una URL de repositorio git pública.',
  RequiresLogin = 'Analizar un archivo ZIP requiere iniciar sesión (protege tu código de subidas anónimas).',
  MissingZipFile = 'Debes seleccionar un archivo ZIP.',
  ZipUploadFailed = 'No fue posible subir el archivo ZIP a S3.',
  ConnectionFailed = 'No fue posible conectar con el servidor. Intenta nuevamente.',
  AnalysisFailedUnknown = 'El análisis falló sin detalle adicional.',
  AnalysisStillProcessing = 'El análisis sigue procesándose; revisa el historial más abajo.',
}
