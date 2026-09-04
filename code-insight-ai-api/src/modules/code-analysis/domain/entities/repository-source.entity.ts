export enum RepositorySourceType {
  Git = 'git',
  Zip = 'zip',
}

/**
 * Entidad que representa el origen del código a analizar,
 * ya materializado en el filesystem local (ej. /tmp en Lambda).
 */
export class RepositorySource {
  constructor(
    public readonly type: RepositorySourceType,
    public readonly localPath: string,
    public readonly originalReference: string, // URL git o nombre del zip
  ) {}
}
