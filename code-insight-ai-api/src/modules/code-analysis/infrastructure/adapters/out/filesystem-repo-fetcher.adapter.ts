import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import simpleGit from 'simple-git';
import AdmZip from 'adm-zip';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { RepoFetcherPort } from '../../../domain/ports/out/repo-fetcher.port';
import { RepositorySource } from '../../../domain/entities/repository-source.entity';
import { extractZipDisplayName } from '../../../domain/utils/zip-display-name.util';

/**
 * Adaptador de salida: obtiene el código fuente clonando un repo git público
 * (shallow clone), descomprimiendo un ZIP local, o descargando un ZIP desde
 * el bucket S3 de uploads, dejándolo en un directorio temporal (compatible
 * con /tmp de AWS Lambda).
 */
@Injectable()
export class FilesystemRepoFetcherAdapter implements RepoFetcherPort {
  private readonly logger = new Logger(FilesystemRepoFetcherAdapter.name);
  private readonly s3Client: S3Client;
  private readonly zipUploadsBucket: string;

  constructor(private readonly config: ConfigService) {
    this.s3Client = new S3Client({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.zipUploadsBucket = this.config.get<string>('ZIP_UPLOADS_BUCKET', '');
  }

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

  async fetchFromS3Zip(zipS3Key: string): Promise<RepositorySource> {
    const workDir = await mkdtemp(join(tmpdir(), 'code-insight-s3zip-'));
    this.logger.log(
      `Descargando s3://${this.zipUploadsBucket}/${zipS3Key} en ${workDir}`,
    );

    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.zipUploadsBucket, Key: zipS3Key }),
    );
    const bytes = await response.Body!.transformToByteArray();
    // El ZIP descargado se guarda FUERA de workDir (en un directorio temporal
    // separado) para que, al extraerlo, workDir solo contenga el contenido
    // del proyecto y no el propio archivo .zip como si fuera un archivo más.
    const downloadDir = await mkdtemp(join(tmpdir(), 'code-insight-s3zip-src-'));
    const localZipPath = join(downloadDir, 'upload.zip');
    await writeFile(localZipPath, Buffer.from(bytes));

    const zip = new AdmZip(localZipPath);
    zip.extractAllTo(workDir, true);
    await rm(downloadDir, { recursive: true, force: true });

    // Se usa el nombre original del archivo (si el frontend lo envió al
    // pedir la URL prefirmada, embebido en el key) en vez del key completo,
    // para que el resumen del análisis muestre un nombre legible.
    return new RepositorySource('zip', workDir, extractZipDisplayName(zipS3Key));
  }

  async cleanup(source: RepositorySource): Promise<void> {
    await rm(source.localPath, { recursive: true, force: true });
  }
}

