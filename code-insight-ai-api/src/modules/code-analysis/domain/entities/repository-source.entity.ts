export enum RepositorySourceType {
  Git = 'git',
  Zip = 'zip',
}

export class RepositorySource {
  constructor(
    public readonly type: RepositorySourceType,
    public readonly localPath: string,
    public readonly originalReference: string,
  ) {}
}
