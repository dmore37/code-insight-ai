import { AnalyzeRepositoryRequestDto } from './analyze-repository-request.dto';
import { ValidationAppError } from '../../../../../../shared/errors/app-error';

describe('GIVEN AnalyzeRepositoryRequestDto.validate', () => {
  describe('GIVEN a body that is not a JSON object', () => {
    it('WHEN validate is called THEN it should throw ValidationAppError', () => {
            const body = 'not an object';

            expect(() => AnalyzeRepositoryRequestDto.validate(body)).toThrow(
        ValidationAppError,
      );
    });
  });

  describe('GIVEN a null body', () => {
    it('WHEN validate is called THEN it should throw ValidationAppError', () => {
            expect(() => AnalyzeRepositoryRequestDto.validate(null)).toThrow(
        ValidationAppError,
      );
    });
  });

  describe('GIVEN a body with a non-string gitUrl', () => {
    it('WHEN validate is called THEN it should throw ValidationAppError', () => {
            const body = { gitUrl: 123 };

            expect(() => AnalyzeRepositoryRequestDto.validate(body)).toThrow(
        ValidationAppError,
      );
    });
  });

  describe('GIVEN a body without gitUrl, zipFilePath or zipS3Key', () => {
    it('WHEN validate is called THEN it should throw ValidationAppError', () => {
            const body = {};

            expect(() => AnalyzeRepositoryRequestDto.validate(body)).toThrow(
        ValidationAppError,
      );
    });
  });

  describe('GIVEN a valid body with only gitUrl', () => {
    it('WHEN validate is called THEN it should return a dto with gitUrl set and the rest undefined', () => {
            const body = { gitUrl: 'https://github.com/owner/repo.git' };

            const dto = AnalyzeRepositoryRequestDto.validate(body);

            expect(dto.gitUrl).toBe('https://github.com/owner/repo.git');
      expect(dto.zipFilePath).toBeUndefined();
      expect(dto.zipS3Key).toBeUndefined();
      expect(dto.zipHash).toBeUndefined();
    });
  });

  describe('GIVEN a valid body with zipS3Key and zipHash', () => {
    it('WHEN validate is called THEN it should return a dto with both fields set', () => {
            const body = { zipS3Key: 'uploads/u1/key.zip', zipHash: 'abc123' };

            const dto = AnalyzeRepositoryRequestDto.validate(body);

            expect(dto.zipS3Key).toBe('uploads/u1/key.zip');
      expect(dto.zipHash).toBe('abc123');
    });
  });
});
