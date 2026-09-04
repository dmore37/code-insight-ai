import { extractZipDisplayName } from './zip-display-name.util';

describe('extractZipDisplayName', () => {
  describe('given an S3 key with the "uploads/{owner}/{uuid}__{name}" shape', () => {
    it('should strip the folder prefix and the uuid separator, keeping only the readable name', () => {
      // Given
      const key = 'uploads/owner-1/11111111-1111-1111-1111-111111111111__my-project.zip';

      // When
      const displayName = extractZipDisplayName(key);

      // Then
      expect(displayName).toBe('my-project.zip');
    });
  });

  describe('given a key without any "__" separator', () => {
    it('should return the file name as-is', () => {
      // Given
      const key = 'uploads/owner-1/plain-name.zip';

      // When
      const displayName = extractZipDisplayName(key);

      // Then
      expect(displayName).toBe('plain-name.zip');
    });
  });

  describe('given a bare file name with no folder prefix', () => {
    it('should return it unchanged', () => {
      // Given / When
      const displayName = extractZipDisplayName('project.zip');

      // Then
      expect(displayName).toBe('project.zip');
    });
  });
});
