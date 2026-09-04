import { Injectable } from '@nestjs/common';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { RepositorySource } from '../../../domain/entities/repository-source.entity';
import {
  StaticAnalyzerPort,
  StaticAnalysisResult,
  StaticAnalysisEvidence,
} from '../../../domain/ports/out/static-analyzer.port';
import { DetectedComponent, DetectedComponentType } from '../../../domain/entities/analysis-result.entity';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  '.angular',
  'coverage',
  '.idea',
  '.vscode',
]);

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.java': 'Java',
  '.py': 'Python',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.cs': 'C#',
};

interface FileEntry {
  fullPath: string;
  relativePath: string;
  ext: string;
}

/**
 * Adaptador de salida: analiza estáticamente el proyecto mediante
 * heurísticas (sin IA): conteo de archivos, detección de framework
 * por archivos de manifiesto, y detección de componentes por
 * convención de carpetas/decoradores.
 */
@Injectable()
export class HeuristicStaticAnalyzerAdapter implements StaticAnalyzerPort {
  async analyze(source: RepositorySource): Promise<StaticAnalysisResult> {
    const files = this.walk(source.localPath);

    const projectName = this.detectProjectName(source, files);
    const mainLanguage = this.detectMainLanguage(files);
    const mainFramework = this.detectFramework(source.localPath, files);
    const components = this.detectComponents(files);
    const evidences = this.collectEvidences(files);
    const fileTreeSummary = this.buildFileTreeSummary(files);
    const keyFileExcerpts = this.extractKeyFiles(files);

    return {
      general: {
        projectName,
        mainLanguage,
        mainFramework,
        approxFileCount: files.length,
      },
      components,
      evidences,
      fileTreeSummary,
      keyFileExcerpts,
    };
  }

  private walk(root: string): FileEntry[] {
    const result: FileEntry[] = [];

    const visit = (dir: string) => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry)) continue;
        const fullPath = join(dir, entry);
        let stats;
        try {
          stats = statSync(fullPath);
        } catch {
          continue;
        }

        if (stats.isDirectory()) {
          visit(fullPath);
        } else {
          result.push({
            fullPath,
            relativePath: relative(root, fullPath),
            ext: extname(entry).toLowerCase(),
          });
        }
      }
    };

    visit(root);
    return result;
  }

  private detectProjectName(source: RepositorySource, files: FileEntry[]): string {
    const pkgJson = files.find((f) => f.relativePath === 'package.json');
    if (pkgJson) {
      try {
        const content = JSON.parse(readFileSync(pkgJson.fullPath, 'utf-8'));
        if (content.name) return content.name;
      } catch {
        /* ignore parse errors */
      }
    }
    const parts = source.originalReference.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1]?.replace(/\.git$/, '') ?? 'proyecto-desconocido';
  }

  private detectMainLanguage(files: FileEntry[]): string {
    const counts = new Map<string, number>();
    for (const f of files) {
      const lang = LANGUAGE_BY_EXT[f.ext];
      if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
    let best = 'Desconocido';
    let bestCount = 0;
    for (const [lang, count] of counts) {
      if (count > bestCount) {
        best = lang;
        bestCount = count;
      }
    }
    return best;
  }

  private detectFramework(root: string, files: FileEntry[]): string {
    const has = (name: string) => files.some((f) => f.relativePath === name);
    const readJson = (name: string): any => {
      try {
        return JSON.parse(readFileSync(join(root, name), 'utf-8'));
      } catch {
        return {};
      }
    };

    if (has('angular.json')) return 'Angular';
    if (has('pom.xml')) return 'Spring Boot (Maven)';
    if (has('build.gradle') || has('build.gradle.kts')) return 'Spring Boot (Gradle)';
    if (has('package.json')) {
      const pkg = readJson('package.json');
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['@nestjs/core']) return 'NestJS';
      if (deps['express']) return 'Express';
      if (deps['react']) return 'React';
      if (deps['vue']) return 'Vue';
      return 'Node.js';
    }
    if (has('requirements.txt') || has('pyproject.toml')) return 'Python';
    return 'Desconocido';
  }

  private detectComponents(files: FileEntry[]): DetectedComponent[] {
    const components: DetectedComponent[] = [];

    const rules: { regex: RegExp; type: DetectedComponent['type'] }[] = [
      { regex: /controller\.ts$|controller\.js$|Controller\.java$/i, type: DetectedComponentType.Controller },
      { regex: /service\.ts$|service\.js$|Service\.java$/i, type: DetectedComponentType.Service },
      { regex: /repository\.ts$|repository\.js$|Repository\.java$/i, type: DetectedComponentType.Repository },
      { regex: /(entity|model)\.ts$|Entity\.java$|Model\.java$/i, type: DetectedComponentType.Model },
      { regex: /\.component\.ts$/i, type: DetectedComponentType.AngularComponent },
    ];

    for (const file of files) {
      for (const rule of rules) {
        if (rule.regex.test(file.relativePath)) {
          components.push({
            type: rule.type,
            name: file.relativePath.split('/').pop() ?? file.relativePath,
            path: file.relativePath,
          });
          break;
        }
      }
    }

    return components;
  }

  private collectEvidences(files: FileEntry[]): StaticAnalysisEvidence[] {
    const evidences: StaticAnalysisEvidence[] = [];
    const patterns: { regex: RegExp; description: string }[] = [
      { regex: /@RestController/, description: 'Uso de @RestController (Spring MVC)' },
      { regex: /@Controller\(/, description: 'Uso de @Controller (NestJS)' },
      { regex: /@Injectable\(/, description: 'Uso de @Injectable (inyección de dependencias)' },
      { regex: /@Entity/, description: 'Entidad de persistencia (@Entity)' },
      { regex: /HttpClient/, description: 'Consumo de APIs con HttpClient (Angular)' },
      { regex: /docker-compose/i, description: 'Presencia de docker-compose (posibles microservicios)' },
    ];

    const candidateFiles = files.filter((f) =>
      ['.ts', '.js', '.java'].includes(f.ext),
    );

    for (const file of candidateFiles.slice(0, 300)) {
      let content: string;
      try {
        content = readFileSync(file.fullPath, 'utf-8');
      } catch {
        continue;
      }
      for (const pattern of patterns) {
        if (pattern.regex.test(content)) {
          evidences.push({ description: pattern.description, filePath: file.relativePath });
        }
      }
    }

    return evidences;
  }

  private buildFileTreeSummary(files: FileEntry[]): string {
    return files
      .slice(0, 200)
      .map((f) => f.relativePath)
      .join('\n');
  }

  private extractKeyFiles(files: FileEntry[]): { path: string; content: string }[] {
    const keyNames = ['main.ts', 'main.java', 'app.module.ts', 'index.ts', 'app.py'];
    const result: { path: string; content: string }[] = [];

    for (const file of files) {
      const base = file.relativePath.split('/').pop() ?? '';
      if (keyNames.includes(base) && result.length < 5) {
        try {
          const content = readFileSync(file.fullPath, 'utf-8').slice(0, 2000);
          result.push({ path: file.relativePath, content });
        } catch {
          /* ignore */
        }
      }
    }

    return result;
  }
}
