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

const VALID_PATTERNS: ArchitecturePattern[] = [
  'Monolito',
  'MVC',
  'Clean Architecture',
  'Hexagonal',
  'Microservicios',
  'N-Capas',
  'Indeterminado',
];

/**
 * Adaptador de salida: usa Amazon Bedrock (modelo Claude de Anthropic)
 * para generar el análisis funcional, la inferencia de arquitectura y
 * las recomendaciones/riesgos, a partir del resultado del análisis estático.
 */
@Injectable()
export class BedrockAiAnalyzerAdapter implements AiAnalyzerPort {
  private readonly logger = new Logger(BedrockAiAnalyzerAdapter.name);
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor(private readonly config: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.modelId = this.config.get<string>(
      'BEDROCK_MODEL_ID',
      'anthropic.claude-3-haiku-20240307-v1:0',
    );
  }

  async analyze(staticResult: StaticAnalysisResult): Promise<AiAnalysisResult> {
    const prompt = this.buildPrompt(staticResult);

    try {
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const response = await this.client.send(command);
      const raw = new TextDecoder().decode(response.body);
      const parsed = JSON.parse(raw);
      const text: string = parsed.content?.[0]?.text ?? '{}';

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
  "architecturePattern": "uno de: Monolito | MVC | Clean Architecture | Hexagonal | Microservicios | N-Capas | Indeterminado",
  "architectureConfidence": number entre 0 y 1,
  "architectureEvidences": ["string"],
  "recommendations": ["string"],
  "risks": ["string"]
}

Información general:
- Nombre del proyecto: ${staticResult.general.projectName}
- Lenguaje principal: ${staticResult.general.mainLanguage}
- Framework principal: ${staticResult.general.mainFramework}
- Cantidad de archivos: ${staticResult.general.approxFileCount}

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
      : 'Indeterminado';

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

  /** Fallback simple si Bedrock no está disponible (permisos, red, etc.) */
  private fallback(staticResult: StaticAnalysisResult): AiAnalysisResult {
    return {
      functional: {
        summary: `Proyecto ${staticResult.general.projectName} desarrollado principalmente en ${staticResult.general.mainLanguage} usando ${staticResult.general.mainFramework}.`,
        technologiesDetected: [
          staticResult.general.mainLanguage,
          staticResult.general.mainFramework,
        ],
      },
      architecture: {
        pattern: 'Indeterminado',
        confidence: 0.3,
        evidences: staticResult.evidences.map((e) => e.description),
      },
      findings: {
        recommendations: ['Configurar acceso a Bedrock para un análisis más preciso.'],
        risks: [],
      },
    };
  }
}
