import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../../config/env.schema';

/**
 * Pino estruturado em JSON com requestId por requisição (ARCHITECTURE §4).
 * Nunca loga credenciais: authorization/cookie são removidos do log.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const requestId =
              typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
            res.setHeader('x-request-id', requestId);
            return requestId;
          },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie'],
            remove: true,
          },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
