import { ArgumentsHost, HttpException, NotFoundException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';

interface CapturedResponse {
  statusCode: number | null;
  body: unknown;
}

function fakeHost(captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
    },
  };
  return {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

function makeFilter(): { filter: AllExceptionsFilter; errorLog: jest.Mock } {
  const errorLog = jest.fn();
  const logger = { setContext: jest.fn(), error: errorLog } as unknown as PinoLogger;
  return { filter: new AllExceptionsFilter(logger), errorLog };
}

describe('AllExceptionsFilter — formato padronizado (ARCHITECTURE §3)', () => {
  it('HttpException vira envelope com code derivado do status', () => {
    const captured: CapturedResponse = { statusCode: null, body: null };
    const { filter } = makeFilter();
    filter.catch(new NotFoundException('Recurso não encontrado'), fakeHost(captured));
    expect(captured.statusCode).toBe(404);
    expect(captured.body).toEqual({
      success: false,
      error: { message: 'Recurso não encontrado', code: 'NOT_FOUND', details: {} },
    });
  });

  it('resposta em objeto preserva campos extras em details (sem statusCode/error)', () => {
    const captured: CapturedResponse = { statusCode: null, body: null };
    const { filter } = makeFilter();
    filter.catch(
      new HttpException({ message: 'Inválido', statusCode: 422, field: 'amountCents' }, 422),
      fakeHost(captured),
    );
    expect(captured.body).toEqual({
      success: false,
      error: {
        message: 'Inválido',
        code: 'UNPROCESSABLE_ENTITY',
        details: { field: 'amountCents' },
      },
    });
  });

  it('erro desconhecido vira 500 genérico SEM stacktrace, e o stack vai para o log', () => {
    const captured: CapturedResponse = { statusCode: null, body: null };
    const { filter, errorLog } = makeFilter();
    filter.catch(new Error('segredo interno com stack'), fakeHost(captured));
    expect(captured.statusCode).toBe(500);
    expect(captured.body).toEqual({
      success: false,
      error: { message: 'Erro interno do servidor', code: 'INTERNAL_ERROR', details: {} },
    });
    expect(JSON.stringify(captured.body)).not.toContain('segredo interno');
    expect(errorLog).toHaveBeenCalledTimes(1);
  });

  it('mensagens em array (estilo validação) são unidas em uma única mensagem', () => {
    const captured: CapturedResponse = { statusCode: null, body: null };
    const { filter } = makeFilter();
    filter.catch(
      new HttpException({ message: ['a é obrigatório', 'b inválido'] }, 400),
      fakeHost(captured),
    );
    expect(captured.body).toMatchObject({
      error: { message: 'a é obrigatório; b inválido', code: 'BAD_REQUEST' },
    });
  });
});
