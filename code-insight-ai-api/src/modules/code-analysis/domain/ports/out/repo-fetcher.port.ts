import { RepositorySource } from '../../entities/repository-source.entity';

/**
 * Puerto de salida: obtiene el código fuente en disco a partir de una URL git
 * o un archivo ZIP. Implementado por adaptadores de infraestructura.
 */
export abstract class RepoFetcherPort {
  abstract fetchFromGit(gitUrl: string): Promise<RepositorySource>;
  abstract fetchFromZip(zipFilePath: string): Promise<RepositorySource>;
  abstract cleanup(source: RepositorySource): Promise<void>;
}
