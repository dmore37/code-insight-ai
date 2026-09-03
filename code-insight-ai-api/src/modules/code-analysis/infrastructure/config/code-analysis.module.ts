import { Module } from '@nestjs/common';
import { AnalysisController } from '../adapters/in/http/analysis.controller';
import { AnalyzeRepositoryUseCase } from '../../domain/ports/in/analyze-repository.use-case';
import { AnalyzeRepositoryService } from '../../domain/services/analyze-repository.service';
import { FilesystemRepoFetcherAdapter } from '../adapters/out/filesystem-repo-fetcher.adapter';
import { HeuristicStaticAnalyzerAdapter } from '../adapters/out/heuristic-static-analyzer.adapter';
import { BedrockAiAnalyzerAdapter } from '../adapters/out/bedrock-ai-analyzer.adapter';
import {
  REPO_FETCHER_PORT,
  STATIC_ANALYZER_PORT,
  AI_ANALYZER_PORT,
} from './tokens';

/**
 * Módulo de wiring de la arquitectura hexagonal: conecta cada puerto con su
 * adaptador concreto. El dominio (services, entities, ports) no conoce
 * Nest ni AWS; solo esta capa de infraestructura los conoce.
 */
@Module({
  controllers: [AnalysisController],
  providers: [
    {
      provide: AnalyzeRepositoryUseCase,
      useClass: AnalyzeRepositoryService,
    },
    {
      provide: REPO_FETCHER_PORT,
      useClass: FilesystemRepoFetcherAdapter,
    },
    {
      provide: STATIC_ANALYZER_PORT,
      useClass: HeuristicStaticAnalyzerAdapter,
    },
    {
      provide: AI_ANALYZER_PORT,
      useClass: BedrockAiAnalyzerAdapter,
    },
  ],
})
export class CodeAnalysisModule {}
