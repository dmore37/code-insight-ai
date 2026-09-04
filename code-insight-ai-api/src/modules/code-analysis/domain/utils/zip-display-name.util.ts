
export function extractZipDisplayName(zipS3Key: string): string {
  const fileName = zipS3Key.split('/').pop() ?? zipS3Key;
  const separatorIndex = fileName.indexOf('__');
  return separatorIndex >= 0 ? fileName.slice(separatorIndex + 2) : fileName;
}
