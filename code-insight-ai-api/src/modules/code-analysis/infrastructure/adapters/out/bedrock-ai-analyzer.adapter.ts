import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  AiAnalyzerPort,
  AiAnalysisResult,
} from '../../../domain/ports/out/ai-analyzer.port';
import { StaticAnalysisResult } from '../../../domain/ports/out/static-analyzer.port';
import { ArchitecturePattern } from '../../../domain/entities/analysis-result.entity';
import { DEFAULT_AWS_REGION } from '../../config/defaults';

const VALID_PATTERNS: ArchitecturePattern[] = Object.values(ArchitecturePattern);

@Injectable()
export class BedrockAiAnalyzerAdapter implements AiAnalyzerPort {
  private readonly logger = new Logger(BedrockAiAnalyzerAdapter.name);
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor(private readonly config: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: this.config.get<string>('AWS_REGION', DEFAULT_AWS_REGION),
    });
    this.modelId = this.config.get<string>(
      'BEDROCK_MODEL_ID',
      'amazon.nova-lite-v1:0',
    );
  }

  private isNovaModel(): boolean {
    return this.modelId.startsWith('amazon.nova');
  }

  private buildRequestBody(prompt: string): string {
    if (this.isNovaModel()) {
      return JSON.stringify({
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 1500 },
      });
    }
    return JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });
  }

  private extractText(parsed: any): string {
    if (this.isNovaModel()) {
      return parsed.output?.message?.content?.[0]?.text ?? '{}';
    }
    return parsed.content?.[0]?.text ?? '{}';
  }

  async analyze(staticResult: StaticAnalysisResult): Promise<AiAnalysisResult> {
    const prompt = this.buildPrompt(staticResult);

    try {
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: this.buildRequestBody(prompt),
      });

      const response = await this.client.send(command);
      const raw = new TextDecoder().decode(response.body);
      const parsed = JSON.parse(raw);
      const text: string = this.extractText(parsed);

      return this.parseAiResponse(text);
    } catch (error) {
      this.logger.warn(
        `Fallo al invocar Bedrock, usando fallback heurístico: ${error}`,
      );
      return this.fallback(staticResult);
    }
  }

  private buildPrompt(staticResult: StaticAnalysisResult): string {
    return `Eres un arquitecto de software senior. Analiza el siguiente resumen de un repositorio de código y responde EXCLUSIVAMENTE con un JSON válido (sin markdown, sin texto adicional) con esta forma exacta:
{
  "summary": "string: descripción funcional de la aplicación en 2-3 frases",
  "technologiesDetected": ["string"],
  "architecturePattern": "uno de: Monolito | MVC | Clean Architecture | Hexagonal | Microservicios | N-Capas | Infraestructura como Código (IaC) | Indeterminado",
  "architectureConfidence": number entre 0 y 1,
  "architectureEvidences": ["string"],
  "recommendations": ["string"],
  "risks": ["string"]
}

IMPORTANTE para clasificar "architecturePattern": la ESTRUCTURA DE CARPETAS tiene prioridad sobre el uso de decoradores como @Controller/@Injectable (estos aparecen tanto en MVC como en Hexagonal/Clean, así que NO son suficientes para inferir MVC). Reglas:
- Si el repositorio es principalmente archivos ".tf" (Terraform) o similar (IaC), clasifica "architecturePattern" como "Infraestructura como Código (IaC)" con confianza alta, y usa "Terraform" (o la herramienta de IaC detectada) como "mainFramework"/tecnología, NO "Desconocido". Este NO es un patrón de arquitectura de aplicación (MVC/Hexagonal/etc.), es una convención propia de IaC.
- Si ves evidencia de carpetas "domain/ports" (in/out) junto con "infrastructure/adapters" (in/out), o una separación clara "domain/" vs "infrastructure/" con puertos e implementaciones, clasifica como "Hexagonal" (o "Clean Architecture" si además hay capas de "application"/"use-cases"), NO como MVC.
- Solo clasifica como "MVC" si ves la estructura clásica de carpetas "controllers/" + "models/" + "views/" sin separación domain/infrastructure.
- Si no hay evidencia clara de ningún patrón, usa "Indeterminado" con confianza baja en vez de adivinar "MVC" por defecto.

Información general:
- Nombre del proyecto: ${staticResult.general.projectName}
- Lenguaje principal: ${staticResult.general.mainLanguage}
- Framework principal: ${staticResult.general.mainFramework}
- Cantidad de archivos: ${staticResult.general.approxFileCount}

Componentes detectados por convención de nombres (usa esto para tu análisis, no inventes otros):
${staticResult.components.map((c) => `- [${c.type}] ${c.path}${c.endpoints?.length ? ' -> ' + c.endpoints.map((e) => `${e.method} ${e.path}`).join(', ') : ''}`).join('\n') || 'Ninguno'}

Evidencias detectadas por análisis estático:
${staticResult.evidences.map((e) => `- ${e.description} (${e.filePath})`).join('\n') || 'Ninguna'}

Árbol de archivos (resumido):
${staticResult.fileTreeSummary}

Extractos de archivos clave:
${staticResult.keyFileExcerpts.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n')}
`;
  }

  private parseAiResponse(text: string): AiAnalysisResult {
    let json: any;
    try {
      const cleaned = text.trim().replace(/^```json|```$/g, '');
      json = JSON.parse(cleaned);
    } catch {
      json = {};
    }

    const pattern: ArchitecturePattern = VALID_PATTERNS.includes(
      json.architecturePattern,
    )
      ? json.architecturePattern
      : ArchitecturePattern.Undetermined;

    return {
      functional: {
        summary: json.summary ?? 'No fue posible generar el resumen funcional.',
        technologiesDetected: json.technologiesDetected ?? [],
      },
      architecture: {
        pattern,
        confidence: typeof json.architectureConfidence === 'number'
          ? json.architectureConfidence
          : 0.5,
        evidences: json.architectureEvidences ?? [],
      },
      findings: {
        recommendations: json.recommendations ?? [],
        risks: json.risks ?? [],
      },
    };
  }

  private fallback(staticResult: StaticAnalysisResult): AiAnalysisResult {
    const isIac = staticResult.general.mainFramework === 'Terraform';
    return {
      functional: {
        summary: `Proyecto ${staticResult.general.projectName} desarrollado principalmente en ${staticResult.general.mainLanguage} usando ${staticResult.general.mainFramework}.`,
        technologiesDetected: [
          staticResult.general.mainLanguage,
          staticResult.general.mainFramework,
        ],
      },
      architecture: {
        pattern: isIac ? ArchitecturePattern.InfrastructureAsCode : ArchitecturePattern.Undetermined,
        confidence: isIac ? 0.7 : 0.3,
        evidences: staticResult.evidences.map((e) => e.description),
      },
      findings: {
        recommendations: ['Configurar acceso a Bedrock para un análisis más preciso.'],
        risks: [],
      },
    };
  }
}
