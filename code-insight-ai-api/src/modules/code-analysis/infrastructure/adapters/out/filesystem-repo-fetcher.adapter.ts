import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import simpleGit from 'simple-git';
import AdmZip from 'adm-zip';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { RepoFetcherPort } from '../../../domain/ports/out/repo-fetcher.port';
import {
  RepositorySource,
  RepositorySourceType,
} from '../../../domain/entities/repository-source.entity';
import { extractZipDisplayName } from '../../../domain/utils/zip-display-name.util';
import { MAX_ZIP_UPLOAD_SIZE_BYTES } from '../../../domain/config/business-rules.constants';

const IGNORED_ZIP_DIR_SEGMENTS = new Set([
  'node_modules',
  '.git',
  '.terraform',
  'dist',
  'build',
  'target',
  '.angular',
  'coverage',
  '.idea',
  '.vscode',
  '__MACOSX',
]);

function isIgnoredZipEntry(entryName: string): boolean {
  return entryName
    .split('/')
    .some((segment) => IGNORED_ZIP_DIR_SEGMENTS.has(segment));
}

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

    return new RepositorySource(RepositorySourceType.Git, workDir, gitUrl);
  }

  async fetchFromZip(zipFilePath: string): Promise<RepositorySource> {
    const workDir = await mkdtemp(join(tmpdir(), 'code-insight-zip-'));
    this.logger.log(`Descomprimiendo ${zipFilePath} en ${workDir}`);

    const zip = new AdmZip(zipFilePath);
    this.extractFiltered(zip, workDir);

    return new RepositorySource(RepositorySourceType.Zip, workDir, zipFilePath);
  }

  async fetchFromS3Zip(zipS3Key: string): Promise<RepositorySource> {
    const head = await this.s3Client.send(
      new HeadObjectCommand({ Bucket: this.zipUploadsBucket, Key: zipS3Key }),
    );
    const sizeBytes = head.ContentLength ?? 0;
    if (sizeBytes > MAX_ZIP_UPLOAD_SIZE_BYTES) {
      throw new Error(
        `El archivo ZIP (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) supera el límite permitido de ${MAX_ZIP_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB. Verifica que no incluya carpetas como node_modules, dist, .git o .terraform.`,
      );
    }

    const workDir = await mkdtemp(join(tmpdir(), 'code-insight-s3zip-'));
    this.logger.log(
      `Descargando s3://${this.zipUploadsBucket}/${zipS3Key} en ${workDir}`,
    );

    const response = await this.s3Client.send(
      new GetObjectCommand({ Bucket: this.zipUploadsBucket, Key: zipS3Key }),
    );
    const bytes = await response.Body!.transformToByteArray();

    const downloadDir = await mkdtemp(join(tmpdir(), 'code-insight-s3zip-src-'));
    const localZipPath = join(downloadDir, 'upload.zip');
    await writeFile(localZipPath, Buffer.from(bytes));

    const zip = new AdmZip(localZipPath);
    this.extractFiltered(zip, workDir);
    await rm(downloadDir, { recursive: true, force: true });

    return new RepositorySource(RepositorySourceType.Zip, workDir, extractZipDisplayName(zipS3Key));
  }

  private extractFiltered(zip: AdmZip, workDir: string): void {
    for (const entry of zip.getEntries()) {
      if (isIgnoredZipEntry(entry.entryName)) continue;
      zip.extractEntryTo(entry, workDir, true, true, false);
    }
  }

  async cleanup(source: RepositorySource): Promise<void> {
    await rm(source.localPath, { recursive: true, force: true });
  }
}

