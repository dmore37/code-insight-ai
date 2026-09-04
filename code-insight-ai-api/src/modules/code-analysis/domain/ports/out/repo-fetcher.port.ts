import { RepositorySource } from '../../entities/repository-source.entity';

/**
 * Puerto de salida: obtiene el código fuente en disco a partir de una URL git
 * o un archivo ZIP (local o en S3). Implementado por adaptadores de
 * infraestructura.
 */
export abstract class RepoFetcherPort {
  abstract fetchFromGit(gitUrl: string): Promise<RepositorySource>;
  abstract fetchFromZip(zipFilePath: string): Promise<RepositorySource>;
  /** Descarga un ZIP desde el bucket S3 de uploads (por su key) y lo extrae. */
  abstract fetchFromS3Zip(zipS3Key: string): Promise<RepositorySource>;
  abstract cleanup(source: RepositorySource): Promise<void>;
}

