import { ValidationAppError } from '../../../../../../shared/errors/app-error';
import { AnalyzeRepositoryValidationMessage } from '../../../../domain/errors/analyze-repository-validation-message.enum';

function assertOptionalString(
  value: unknown,
  message: AnalyzeRepositoryValidationMessage,
): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new ValidationAppError(message);
  }
}

export class AnalyzeRepositoryRequestDto {
  gitUrl?: string;
  zipFilePath?: string;
  zipS3Key?: string;

  zipHash?: string;

  static validate(body: unknown): AnalyzeRepositoryRequestDto {
    const dto = new AnalyzeRepositoryRequestDto();

    if (typeof body !== 'object' || body === null) {
      throw new ValidationAppError(AnalyzeRepositoryValidationMessage.InvalidBody);
    }

    const { gitUrl, zipFilePath, zipS3Key, zipHash } = body as Record<string, unknown>;

    assertOptionalString(gitUrl, AnalyzeRepositoryValidationMessage.InvalidGitUrl);
    assertOptionalString(zipFilePath, AnalyzeRepositoryValidationMessage.InvalidZipFilePath);
    assertOptionalString(zipS3Key, AnalyzeRepositoryValidationMessage.InvalidZipS3Key);
    assertOptionalString(zipHash, AnalyzeRepositoryValidationMessage.InvalidZipHash);

    if (!gitUrl && !zipFilePath && !zipS3Key) {
      throw new ValidationAppError(AnalyzeRepositoryValidationMessage.MissingSource);
    }

    dto.gitUrl = gitUrl;
    dto.zipFilePath = zipFilePath;
    dto.zipS3Key = zipS3Key;
    dto.zipHash = zipHash;
    return dto;
  }
}
