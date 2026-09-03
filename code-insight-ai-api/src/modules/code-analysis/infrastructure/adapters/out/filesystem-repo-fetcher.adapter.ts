import { Injectable, Logger } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import simpleGit from 'simple-git';
import AdmZip from 'adm-zip';
import { RepoFetcherPort } from '../../../domain/ports/out/repo-fetcher.port';
import { RepositorySource } from '../../../domain/entities/repository-source.entity';

/**
 * Adaptador de salida: obtiene el código fuente clonando un repo git público
 * (shallow clone) o descomprimiendo un ZIP, dejándolo en un directorio
 * temporal (compatible con /tmp de AWS Lambda).
 */
@Injectable()
export class FilesystemRepoFetcherAdapter implements RepoFetcherPort {
  private readonly logger = new Logger(FilesystemRepoFetcherAdapter.name);

  async fetchFromGit(gitUrl: string): Promise<RepositorySource> {
    const workDir = await mkdtemp(join(tmpdir(), 'code-insight-git-'));
    this.logger.log(`Clonando ${gitUrl} en ${workDir}`);

    const git = simpleGit();
    await git.clone(gitUrl, workDir, ['--depth', '1']);

    return new RepositorySource('git', workDir, gitUrl);
  }

  async fetchFromZip(zipFilePath: string): Promise<RepositorySource> {
    const workDir = await mkdtemp(join(tmpdir(), 'code-insight-zip-'));
    this.logger.log(`Descomprimiendo ${zipFilePath} en ${workDir}`);

    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(workDir, true);

    return new RepositorySource('zip', workDir, zipFilePath);
  }

  async cleanup(source: RepositorySource): Promise<void> {
    await rm(source.localPath, { recursive: true, force: true });
  }
}
