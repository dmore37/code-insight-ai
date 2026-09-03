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

  static validate(body: unknown): AnalyzeRepositoryRequestDto {
    const dto = new AnalyzeRepositoryRequestDto();

    if (typeof body !== 'object' || body === null) {
      throw new ValidationAppError('El cuerpo de la solicitud debe ser un objeto JSON.');
    }

    const { gitUrl, zipFilePath } = body as Record<string, unknown>;

    if (gitUrl !== undefined && typeof gitUrl !== 'string') {
      throw new ValidationAppError('"gitUrl" debe ser un texto.');
    }
    if (zipFilePath !== undefined && typeof zipFilePath !== 'string') {
      throw new ValidationAppError('"zipFilePath" debe ser un texto.');
    }
    if (!gitUrl && !zipFilePath) {
      throw new ValidationAppError(
        'Debe proporcionar "gitUrl" o "zipFilePath".',
      );
    }

    dto.gitUrl = gitUrl as string | undefined;
    dto.zipFilePath = zipFilePath as string | undefined;
    return dto;
  }
}
