import { BedrockAiAnalyzerAdapter } from './bedrock-ai-analyzer.adapter';
import { ConfigService } from '@nestjs/config';
import { ArchitecturePattern } from '../../../domain/entities/analysis-result.entity';
import { StaticAnalysisResult } from '../../../application/ports/out/static-analyzer.port';

describe('BedrockAiAnalyzerAdapter', () => {
  let send: jest.Mock;

  const staticResult: StaticAnalysisResult = {
    general: {
      projectName: 'repo',
      mainLanguage: 'TypeScript',
      mainFramework: 'NestJS',
      approxFileCount: 10,
    },
    components: [],
    evidences: [],
    fileTreeSummary: 'src/',
    keyFileExcerpts: [],
  };

  function buildAdapter(modelId: string) {
    const config = {
      get: jest.fn((key: string, fallback?: unknown) =>
        key === 'BEDROCK_MODEL_ID' ? modelId : fallback,
      ),
    } as unknown as ConfigService;
    const adapter = new BedrockAiAnalyzerAdapter(config);
    send = jest.fn();
    (adapter as unknown as { client: { send: jest.Mock } }).client = { send };
    return adapter;
  }

  function respondWith(body: unknown) {
    send.mockResolvedValue({ body: new TextEncoder().encode(JSON.stringify(body)) });
  }

  describe('given the Amazon Nova model returns a valid JSON payload', () => {
    it('should parse the functional/architecture/findings sections correctly', async () => {
            const adapter = buildAdapter('amazon.nova-lite-v1:0');
      respondWith({
        output: {
          message: {
            content: [
              {
                text: JSON.stringify({
                  summary: 'A NestJS API.',
                  technologiesDetected: ['NestJS', 'TypeScript'],
                  architecturePattern: 'Hexagonal',
                  architectureConfidence: 0.9,
                  architectureEvidences: ['ports/adapters detected'],
                  recommendations: ['Add more tests'],
                  risks: ['No rate limiting'],
                }),
              },
            ],
          },
        },
      });

            const result = await adapter.analyze(staticResult);

            expect(result.functional.summary).toBe('A NestJS API.');
      expect(result.architecture.pattern).toBe(ArchitecturePattern.Hexagonal);
      expect(result.architecture.confidence).toBe(0.9);
      expect(result.findings.recommendations).toEqual(['Add more tests']);
    });
  });

  describe('given an Anthropic Claude model returns a valid JSON payload', () => {
    it('should parse the response from the "content[0].text" shape', async () => {
            const adapter = buildAdapter('anthropic.claude-3-haiku');
      respondWith({
        content: [
          {
            text: JSON.stringify({
              summary: 'A Claude-analyzed project.',
              technologiesDetected: [],
              architecturePattern: 'MVC',
              architectureConfidence: 0.6,
              architectureEvidences: [],
              recommendations: [],
              risks: [],
            }),
          },
        ],
      });

            const result = await adapter.analyze(staticResult);

            expect(result.functional.summary).toBe('A Claude-analyzed project.');
      expect(result.architecture.pattern).toBe(ArchitecturePattern.Mvc);
    });
  });

  describe('given the model returns an architecturePattern outside the known enum values', () => {
    it('should fall back to "Indeterminado" instead of trusting the raw value', async () => {
            const adapter = buildAdapter('amazon.nova-lite-v1:0');
      respondWith({
        output: {
          message: {
            content: [
              {
                text: JSON.stringify({
                  summary: 'summary',
                  technologiesDetected: [],
                  architecturePattern: 'Something Made Up',
                  architectureConfidence: 0.5,
                  architectureEvidences: [],
                  recommendations: [],
                  risks: [],
                }),
              },
            ],
          },
        },
      });

            const result = await adapter.analyze(staticResult);

            expect(result.architecture.pattern).toBe(ArchitecturePattern.Undetermined);
    });
  });

  describe('given Bedrock throws (e.g. AccessDeniedException or network failure)', () => {
    it('should fall back to a heuristic result instead of throwing', async () => {
            const adapter = buildAdapter('amazon.nova-lite-v1:0');
      send.mockRejectedValue(new Error('AccessDeniedException'));

            const result = await adapter.analyze(staticResult);

            expect(result.architecture.pattern).toBe(ArchitecturePattern.Undetermined);
      expect(result.functional.summary).toContain('repo');
      expect(result.findings.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('given the model returns text wrapped in a markdown code fence', () => {
    it('should strip the fence before parsing the JSON', async () => {
            const adapter = buildAdapter('amazon.nova-lite-v1:0');
      const rawJson = JSON.stringify({
        summary: 'fenced',
        technologiesDetected: [],
        architecturePattern: 'Monolito',
        architectureConfidence: 0.4,
        architectureEvidences: [],
        recommendations: [],
        risks: [],
      });
      respondWith({
        output: { message: { content: [{ text: '```json\n' + rawJson + '\n```' }] } },
      });

            const result = await adapter.analyze(staticResult);

            expect(result.functional.summary).toBe('fenced');
      expect(result.architecture.pattern).toBe(ArchitecturePattern.Monolith);
    });
  });
});
