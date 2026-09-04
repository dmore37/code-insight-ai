import { ValidationAppError } from '../../../../../../shared/errors/app-error';

/**
 * DTO de entrada para analizar un repositorio.
 * Validación manual simple (sin class-validator) para no añadir
 * dependencias extra en el MVP; lanza un ValidationAppError controlado,
 * que el AllExceptionsFilter convertirá en 200 + success:false.
 */
export class AnalyzeRepositoryRequestDto {
  gitUrl?: string;
  zipFilePath?: string;
  zipS3Key?: string;
  /** Hash SHA-256 del ZIP calculado en el cliente (para cache de resultados). */
  zipHash?: string;

  static validate(body: unknown): AnalyzeRepositoryRequestDto {
    const dto = new AnalyzeRepositoryRequestDto();

    if (typeof body !== 'object' || body === null) {
      throw new ValidationAppError('El cuerpo de la solicitud debe ser un objeto JSON.');
    }

    const { gitUrl, zipFilePath, zipS3Key, zipHash } = body as Record<string, unknown>;

    if (gitUrl !== undefined && typeof gitUrl !== 'string') {
      throw new ValidationAppError('"gitUrl" debe ser un texto.');
    }
    if (zipFilePath !== undefined && typeof zipFilePath !== 'string') {
      throw new ValidationAppError('"zipFilePath" debe ser un texto.');
    }
    if (zipS3Key !== undefined && typeof zipS3Key !== 'string') {
      throw new ValidationAppError('"zipS3Key" debe ser un texto.');
    }
    if (zipHash !== undefined && typeof zipHash !== 'string') {
      throw new ValidationAppError('"zipHash" debe ser un texto.');
    }
    if (!gitUrl && !zipFilePath && !zipS3Key) {
      throw new ValidationAppError(
        'Debe proporcionar "gitUrl", "zipFilePath" o "zipS3Key".',
      );
    }

    dto.gitUrl = gitUrl as string | undefined;
    dto.zipFilePath = zipFilePath as string | undefined;
    dto.zipS3Key = zipS3Key as string | undefined;
    dto.zipHash = zipHash as string | undefined;
    return dto;
  }
}
