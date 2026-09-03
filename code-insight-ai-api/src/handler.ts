import serverlessExpress from '@vendia/serverless-express';
import type { Handler } from 'aws-lambda';
import { createNestApp } from './create-app';

/**
 * Entry point para AWS Lambda (imagen Docker).
 *
 * Reutiliza el mismo AppModule/filtros/interceptores que main.ts, pero en
 * lugar de escuchar un puerto TCP, expone el servidor Express interno de
 * Nest a través de @vendia/serverless-express, que traduce eventos de
 * API Gateway <-> peticiones HTTP estándar.
 *
 * La inicialización de Nest (costosa) se cachea entre invocaciones dentro
 * de la misma instancia de Lambda ("cold start" solo la primera vez).
 */
let cachedHandler: Handler;

async function bootstrapLambda(): Promise<Handler> {
  const app = await createNestApp();
  await app.init();

  const expressInstance = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressInstance });
}

export const handler: Handler = async (event, context, callback) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrapLambda();
  }
  return cachedHandler(event, context, callback);
};
