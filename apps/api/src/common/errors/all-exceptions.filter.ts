import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

/** Formato padronizado de erro (ARCHITECTURE §3). Nunca vaza stacktrace ao cliente. */
export interface ErrorEnvelope {
  success: false;
  error: {
    message: string;
    code: string;
    details: Record<string, unknown>;
  };
}

function envelope(message: string, code: string, details: Record<string, unknown>): ErrorEnvelope {
  return { success: false, error: { message, code, details } };
}

/** Extrai message/details da resposta de uma HttpException sem repassar campos internos. */
function normalizeHttpResponse(
  raw: string | object,
  fallbackMessage: string,
): { message: string; details: Record<string, unknown> } {
  if (typeof raw === 'string') {
    return { message: raw, details: {} };
  }
  const {
    message,
    statusCode: _statusCode,
    error: _error,
    ...rest
  } = raw as Record<string, unknown>;
  if (Array.isArray(message)) {
    return { message: message.join('; '), details: rest };
  }
  return { message: typeof message === 'string' ? message : fallbackMessage, details: rest };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toEnvelope(exception);
    if (status >= 500) {
      // o stack vai para o LOG (diagnóstico), jamais para a resposta
      this.logger.error({ err: exception }, 'unhandled exception');
    }
    response.status(status).json(body);
  }

  private toEnvelope(exception: unknown): { status: number; body: ErrorEnvelope } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const { message, details } = normalizeHttpResponse(
        exception.getResponse(),
        exception.message,
      );
      return { status, body: envelope(message, HttpStatus[status] ?? 'ERROR', details) };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: envelope('Erro interno do servidor', 'INTERNAL_ERROR', {}),
    };
  }
}
