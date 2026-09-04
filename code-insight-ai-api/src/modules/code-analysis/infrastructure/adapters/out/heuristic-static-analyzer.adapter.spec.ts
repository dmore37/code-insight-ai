import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HeuristicStaticAnalyzerAdapter } from './heuristic-static-analyzer.adapter';
import { RepositorySource, RepositorySourceType } from '../../../domain/entities/repository-source.entity';
import { DetectedComponentType } from '../../../domain/entities/analysis-result.entity';

describe('HeuristicStaticAnalyzerAdapter', () => {
  let adapter: HeuristicStaticAnalyzerAdapter;
  let workDir: string;

  beforeEach(() => {
    adapter = new HeuristicStaticAnalyzerAdapter();
    workDir = mkdtempSync(join(tmpdir(), 'heuristic-test-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  describe('given a NestJS-like project with a package.json declaring @nestjs/core', () => {
    it('should detect the project name, main language, framework and controller/service components', async () => {
      // Given
      writeFileSync(
        join(workDir, 'package.json'),
        JSON.stringify({ name: 'my-nest-app', dependencies: { '@nestjs/core': '^11.0.0' } }),
      );
      mkdirSync(join(workDir, 'src'));
      writeFileSync(join(workDir, 'src', 'app.controller.ts'), '@Controller()\nexport class AppController {}');
      writeFileSync(join(workDir, 'src', 'app.service.ts'), '@Injectable()\nexport class AppService {}');
      const source = new RepositorySource(RepositorySourceType.Git, workDir, 'https://github.com/owner/my-nest-app.git');

      // When
      const result = await adapter.analyze(source);

      // Then
      expect(result.general.projectName).toBe('my-nest-app');
      expect(result.general.mainLanguage).toBe('TypeScript');
      expect(result.general.mainFramework).toBe('NestJS');
      expect(result.components).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: DetectedComponentType.Controller, name: 'app.controller.ts' }),
          expect.objectContaining({ type: DetectedComponentType.Service, name: 'app.service.ts' }),
        ]),
      );
    });
  });

  describe('given a project without a package.json', () => {
    it('should fall back to the last segment of the original reference as the project name', async () => {
      // Given
      writeFileSync(join(workDir, 'index.py'), 'print("hello")');
      const source = new RepositorySource(
        RepositorySourceType.Git,
        workDir,
        'https://github.com/owner/my-python-repo.git',
      );

      // When
      const result = await adapter.analyze(source);

      // Then
      expect(result.general.projectName).toBe('my-python-repo');
      expect(result.general.mainLanguage).toBe('Python');
    });
  });

  describe('given an angular.json file present at the root', () => {
    it('should detect the framework as "Angular"', async () => {
      // Given
      writeFileSync(join(workDir, 'angular.json'), '{}');
      writeFileSync(join(workDir, 'a.component.ts'), 'export class A {}');
      const source = new RepositorySource(RepositorySourceType.Zip, workDir, 'project.zip');

      // When
      const result = await adapter.analyze(source);

      // Then
      expect(result.general.mainFramework).toBe('Angular');
      expect(result.components[0].type).toBe(DetectedComponentType.AngularComponent);
    });
  });

  describe('given files inside an ignored directory (e.g. node_modules)', () => {
    it('should exclude them from the file count and file tree summary', async () => {
      // Given
      mkdirSync(join(workDir, 'node_modules'));
      writeFileSync(join(workDir, 'node_modules', 'ignored.js'), 'module.exports = {};');
      writeFileSync(join(workDir, 'main.ts'), 'console.log("hi");');
      const source = new RepositorySource(RepositorySourceType.Zip, workDir, 'project.zip');

      // When
      const result = await adapter.analyze(source);

      // Then
      expect(result.general.approxFileCount).toBe(1);
      expect(result.fileTreeSummary).not.toContain('node_modules');
    });
  });

  describe('given a "main.ts" file present among the files', () => {
    it('should include it (truncated to 2000 chars) among the key file excerpts used as AI context', async () => {
      // Given
      const content = 'x'.repeat(3000);
      writeFileSync(join(workDir, 'main.ts'), content);
      const source = new RepositorySource(RepositorySourceType.Zip, workDir, 'project.zip');

      // When
      const result = await adapter.analyze(source);

      // Then
      expect(result.keyFileExcerpts).toHaveLength(1);
      expect(result.keyFileExcerpts[0].path).toBe('main.ts');
      expect(result.keyFileExcerpts[0].content.length).toBe(2000);
    });
  });

  describe('given a file that contains an @Entity annotation', () => {
    it('should collect an evidence describing persistence usage', async () => {
      // Given
      writeFileSync(join(workDir, 'user.entity.ts'), '@Entity()\nexport class User {}');
      const source = new RepositorySource(RepositorySourceType.Zip, workDir, 'project.zip');

      // When
      const result = await adapter.analyze(source);

      // Then
      expect(result.evidences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ description: expect.stringContaining('@Entity') }),
        ]),
      );
    });
  });
});
