import { AnalyzeRepositoryRequestDto } from './analyze-repository-request.dto';
import { ValidationAppError } from '../../../../../../shared/errors/app-error';

describe('AnalyzeRepositoryRequestDto.validate', () => {
  describe('given a body that is not a JSON object', () => {
    it('should throw ValidationAppError', () => {
      // Given
      const body = 'not an object';

      // When / Then
      expect(() => AnalyzeRepositoryRequestDto.validate(body)).toThrow(
        ValidationAppError,
      );
    });
  });

  describe('given a null body', () => {
    it('should throw ValidationAppError', () => {
      // Given / When / Then
      expect(() => AnalyzeRepositoryRequestDto.validate(null)).toThrow(
        ValidationAppError,
      );
    });
  });

  describe('given a body with a non-string gitUrl', () => {
    it('should throw ValidationAppError', () => {
      // Given
      const body = { gitUrl: 123 };

      // When / Then
      expect(() => AnalyzeRepositoryRequestDto.validate(body)).toThrow(
        ValidationAppError,
      );
    });
  });

  describe('given a body without gitUrl, zipFilePath or zipS3Key', () => {
    it('should throw ValidationAppError', () => {
      // Given
      const body = {};

      // When / Then
      expect(() => AnalyzeRepositoryRequestDto.validate(body)).toThrow(
        ValidationAppError,
      );
    });
  });

  describe('given a valid body with only gitUrl', () => {
    it('should return a dto with gitUrl set and the rest undefined', () => {
      // Given
      const body = { gitUrl: 'https://github.com/owner/repo.git' };

      // When
      const dto = AnalyzeRepositoryRequestDto.validate(body);

      // Then
      expect(dto.gitUrl).toBe('https://github.com/owner/repo.git');
      expect(dto.zipFilePath).toBeUndefined();
      expect(dto.zipS3Key).toBeUndefined();
      expect(dto.zipHash).toBeUndefined();
    });
  });

  describe('given a valid body with zipS3Key and zipHash', () => {
    it('should return a dto with both fields set', () => {
      // Given
      const body = { zipS3Key: 'uploads/u1/key.zip', zipHash: 'abc123' };

      // When
      const dto = AnalyzeRepositoryRequestDto.validate(body);

      // Then
      expect(dto.zipS3Key).toBe('uploads/u1/key.zip');
      expect(dto.zipHash).toBe('abc123');
    });
  });
});
