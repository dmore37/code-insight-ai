import { RepositorySource } from '../../entities/repository-source.entity';

export abstract class RepoFetcherPort {
  abstract fetchFromGit(gitUrl: string): Promise<RepositorySource>;
  abstract fetchFromZip(zipFilePath: string): Promise<RepositorySource>;

  abstract fetchFromS3Zip(zipS3Key: string): Promise<RepositorySource>;
  abstract cleanup(source: RepositorySource): Promise<void>;
}

