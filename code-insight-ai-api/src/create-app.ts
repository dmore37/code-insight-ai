import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './shared/interceptors/response-envelope.interceptor';

/**
 * Crea y configura la instancia de Nest compartida entre el entrypoint
 * local (main.ts) y el handler de AWS Lambda (handler.ts), para no
 * duplicar la configuración de filtros/interceptores/CORS.
 */
export async function createNestApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  return app;
}
