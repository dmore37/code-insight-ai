import serverlessExpress from '@vendia/serverless-express';
import type { Handler, SQSEvent } from 'aws-lambda';
import type { INestApplication } from '@nestjs/common';
import { createNestApp } from './create-app';
import { ProcessAnalysisJobUseCase } from './modules/code-analysis/domain/ports/in/process-analysis-job.use-case';

/**
 * Entry point para AWS Lambda (imagen Docker).
 *
 * Este mismo Lambda atiende dos tipos de evento:
 * 1. Peticiones HTTP desde API Gateway: se delegan a Express vía
 *    @vendia/serverless-express (comportamiento original).
 * 2. Mensajes de la cola SQS (event source mapping): se detectan porque
 *    el evento trae `Records` con `eventSource === "aws:sqs"`, y en ese
 *    caso se ejecuta el worker asíncrono (ProcessAnalysisJobUseCase) por
 *    cada mensaje, sin pasar por Express/API Gateway.
 *
 * La inicialización de Nest (costosa) se cachea entre invocaciones dentro
 * de la misma instancia de Lambda ("cold start" solo la primera vez).
 */
let cachedApp: INestApplication;
let cachedHttpHandler: Handler;

function isSqsEvent(event: unknown): event is SQSEvent {
  return (
    !!event &&
    typeof event === 'object' &&
    Array.isArray((event as SQSEvent).Records) &&
    (event as SQSEvent).Records[0]?.eventSource === 'aws:sqs'
  );
}

async function getApp(): Promise<INestApplication> {
  if (!cachedApp) {
    cachedApp = await createNestApp();
    await cachedApp.init();
  }
  return cachedApp;
}

async function bootstrapHttpHandler(): Promise<Handler> {
  const app = await getApp();
  const expressInstance = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressInstance });
}

async function processSqsEvent(event: SQSEvent): Promise<void> {
  const app = await getApp();
  const processJob = app.get(ProcessAnalysisJobUseCase);

  for (const record of event.Records) {
    const job = JSON.parse(record.body);
    await processJob.execute(job);
  }
}

export const handler: Handler = async (event, context, callback) => {
  if (isSqsEvent(event)) {
    return processSqsEvent(event);
  }

  if (!cachedHttpHandler) {
    cachedHttpHandler = await bootstrapHttpHandler();
  }
  return cachedHttpHandler(event, context, callback);
};
