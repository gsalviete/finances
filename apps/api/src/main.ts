import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  configureApp(app);

  // Hardening (Fase 25 / ARCHITECTURE §7)
  const env = app.get(ConfigService<Env, true>);
  app.use(helmet());
  app.enableCors({ origin: env.get('CORS_ORIGIN', { infer: true }).split(','), credentials: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('finances API')
    .setDescription('Quanto eu ainda posso gastar até o final deste mês?')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const config = app.get(ConfigService<Env, true>);
  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
