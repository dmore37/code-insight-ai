import { Injectable } from '@nestjs/common';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { RepositorySource } from '../../../domain/entities/repository-source.entity';
import {
  StaticAnalyzerPort,
  StaticAnalysisResult,
  StaticAnalysisEvidence,
} from '../../../application/ports/out/static-analyzer.port';
import { DetectedComponent, DetectedComponentType, HttpEndpoint } from '../../../domain/entities/analysis-result.entity';

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
  '.tf': 'HCL (Terraform)',
  '.php': 'PHP',
};

interface FileEntry {
  fullPath: string;
  relativePath: string;
  ext: string;
}

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
    const findRootFile = (name: string): FileEntry | undefined => {
      const matches = files.filter(
        (f) => (f.relativePath.split('/').pop() ?? '') === name,
      );
      if (matches.length === 0) return undefined;
      return matches.sort(
        (a, b) => a.relativePath.split('/').length - b.relativePath.split('/').length,
      )[0];
    };
    const has = (name: string) => findRootFile(name) !== undefined;
    const readJson = (name: string): any => {
      const file = findRootFile(name);
      if (!file) return {};
      try {
        return JSON.parse(readFileSync(file.fullPath, 'utf-8'));
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

    if (has('composer.json')) {
      const pkg = readJson('composer.json');
      const deps = { ...pkg.require, ...pkg['require-dev'] };
      if (Object.keys(deps).some((d) => d.startsWith('laravel/'))) return 'Laravel';
      if (Object.keys(deps).some((d) => d.startsWith('symfony/'))) return 'Symfony';
      if (Object.keys(deps).some((d) => d.startsWith('codeigniter'))) return 'CodeIgniter';
      return 'PHP (Composer)';
    }

    const phpFileCount = files.filter((f) => f.ext === '.php').length;
    if (phpFileCount > 0 && phpFileCount >= files.length * 0.3) return 'PHP';

    const tfFileCount = files.filter((f) => f.ext === '.tf').length;
    if (tfFileCount > 0 && tfFileCount >= files.length * 0.3) return 'Terraform';

    return 'Desconocido';
  }

  private detectComponents(files: FileEntry[]): DetectedComponent[] {
    const components: DetectedComponent[] = [];

    const rules: { regex: RegExp; type: DetectedComponent['type'] }[] = [
      { regex: /controller\.ts$|controller\.js$|Controller\.java$|Controller\.php$/i, type: DetectedComponentType.Controller },
      { regex: /service\.ts$|service\.js$|Service\.java$|Service\.php$/i, type: DetectedComponentType.Service },
      { regex: /repository\.ts$|repository\.js$|Repository\.java$|Repository\.php$/i, type: DetectedComponentType.Repository },
      { regex: /(entity|model)\.ts$|Entity\.java$|Model\.java$|Model\.php$/i, type: DetectedComponentType.Model },
      { regex: /\.component\.ts$/i, type: DetectedComponentType.AngularComponent },
    ];

    for (const file of files) {
      for (const rule of rules) {
        if (rule.regex.test(file.relativePath)) {
          const component: DetectedComponent = {
            type: rule.type,
            name: file.relativePath.split('/').pop() ?? file.relativePath,
            path: file.relativePath,
          };

          if (rule.type === DetectedComponentType.Controller) {
            const content = this.safeReadFile(file.fullPath);
            const endpoints = this.extractEndpoints(content);
            if (endpoints.length > 0) component.endpoints = endpoints;
          }

          components.push(component);
          break;
        }
      }

      const content = ['.ts', '.js'].includes(file.ext)
        ? this.safeReadFile(file.fullPath)
        : '';
      if (content) {
        const consumedApis = this.extractConsumedApis(content);
        for (const api of consumedApis) {
          components.push({
            type: DetectedComponentType.ConsumedApi,
            name: `${api.method} ${api.path}`,
            path: file.relativePath,
          });
        }
      }
    }

    return components;
  }

  private safeReadFile(fullPath: string): string {
    try {
      return readFileSync(fullPath, 'utf-8');
    } catch {
      return '';
    }
  }

  private extractEndpoints(content: string): HttpEndpoint[] {
    const endpoints: HttpEndpoint[] = [];

    const controllerPrefixMatch =
      content.match(/@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/) ??
      content.match(/@RequestMapping\(\s*['"`]([^'"`]*)['"`]\s*\)/);
    const prefix = controllerPrefixMatch ? controllerPrefixMatch[1] : '';

    const nestRegex = /@(Get|Post|Put|Delete|Patch)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = nestRegex.exec(content))) {
      const method = match[1].toUpperCase();
      const subPath = match[2] ?? '';
      const path = `/${[prefix, subPath].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
      endpoints.push({ method, path });
    }

    const springRegex = /@(Get|Post|Put|Delete|Patch)Mapping(?:\(\s*(?:['"`]([^'"`]*)['"`])?\s*\))?/g;
    while ((match = springRegex.exec(content))) {
      const method = match[1].toUpperCase();
      const subPath = match[2] ?? '';
      const path = `/${[prefix, subPath].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
      endpoints.push({ method, path });
    }

    const expressRegex = /(?:router|app)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = expressRegex.exec(content))) {
      endpoints.push({ method: match[1].toUpperCase(), path: match[2] });
    }

    return endpoints;
  }

  private extractConsumedApis(content: string): HttpEndpoint[] {
    const apis: HttpEndpoint[] = [];
    const httpClientRegex =
      /\.(?:http|httpClient)\s*\.\s*(get|post|put|delete|patch)\s*(?:<[^>]*>)?\(\s*[`'"]([^`'"]+)[`'"]/gi;
    let match: RegExpExecArray | null;
    while ((match = httpClientRegex.exec(content))) {
      apis.push({ method: match[1].toUpperCase(), path: match[2] });
    }

    const fetchRegex = /fetch\(\s*[`'"]([^`'"]+)[`'"]/g;
    while ((match = fetchRegex.exec(content))) {
      apis.push({ method: 'GET', path: match[1] });
    }

    return apis;
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
      ['.ts', '.js', '.java', '.php'].includes(f.ext),
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

    evidences.push(...this.collectFolderStructureEvidences(files));

    return evidences;
  }

    private collectFolderStructureEvidences(files: FileEntry[]): StaticAnalysisEvidence[] {
    const evidences: StaticAnalysisEvidence[] = [];
    const paths = files.map((f) => f.relativePath.replace(/\\/g, '/'));
    const hasPathMatching = (regex: RegExp) => paths.some((p) => regex.test(p));

    const hasPorts = hasPathMatching(/\/(domain\/)?ports\/(in|out)\//i);
    const hasAdapters = hasPathMatching(/\/(infrastructure\/)?adapters\/(in|out)\//i);
    const hasDomainInfraSplit =
      hasPathMatching(/\/domain\//i) && hasPathMatching(/\/infrastructure\//i);

    if (hasPorts && hasAdapters) {
      evidences.push({
        description:
          'Estructura de carpetas ports/adapters (application/ports/in|out + infrastructure/adapters/in|out): fuerte indicio de Arquitectura Hexagonal (Puertos y Adaptadores), NO MVC clásico.',
        filePath: paths.find((p) => /\/(domain\/)?ports\//i.test(p)) ?? '',
      });
    } else if (hasDomainInfraSplit) {
      evidences.push({
        description:
          'Separación de carpetas domain/ e infrastructure/: indicio de Arquitectura Hexagonal o Clean Architecture, NO MVC clásico.',
        filePath: paths.find((p) => /\/domain\//i.test(p)) ?? '',
      });
    }

    const hasClassicMvcDirs =
      hasPathMatching(/\/(controllers?)\//i) &&
      hasPathMatching(/\/(models?)\//i) &&
      hasPathMatching(/\/(views?)\//i);
    if (hasClassicMvcDirs && !hasPorts && !hasDomainInfraSplit) {
      evidences.push({
        description:
          'Estructura clásica de carpetas controllers/ + models/ + views/: indicio de MVC tradicional.',
        filePath: paths.find((p) => /\/controllers?\//i.test(p)) ?? '',
      });
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
    const keyNames = ['main.ts', 'main.java', 'app.module.ts', 'index.ts', 'app.py', 'index.php', 'composer.json'];
    const result: { path: string; content: string }[] = [];

    for (const file of files) {
      const base = file.relativePath.split('/').pop() ?? '';
      if (keyNames.includes(base) && result.length < 5) {
        try {
          const content = readFileSync(file.fullPath, 'utf-8').slice(0, 2000);
          result.push({ path: file.relativePath, content });
        } catch {

        }
      }
    }

    return result;
  }
}
