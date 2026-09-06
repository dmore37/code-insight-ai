export enum AnalyzeRepositoryValidationMessage {
  InvalidBody = 'El cuerpo de la solicitud debe ser un objeto JSON.',
  InvalidGitUrl = '"gitUrl" debe ser un texto.',
  InvalidZipFilePath = '"zipFilePath" debe ser un texto.',
  InvalidZipS3Key = '"zipS3Key" debe ser un texto.',
  InvalidZipHash = '"zipHash" debe ser un texto.',
  MissingSource = 'Debe proporcionar "gitUrl", "zipFilePath" o "zipS3Key".',
}
