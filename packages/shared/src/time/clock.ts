/**
 * Clock — única porta de acesso a "agora" no domínio.
 *
 * Regra (Fase 5): nenhuma chamada `new Date()`/`Date.now()` fora daqui.
 * Serviços recebem um Clock injetado; testes usam fixedClock para determinismo.
 */

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  // eslint-disable-next-line no-restricted-syntax -- único ponto sancionado de leitura do relógio
  now: () => new Date(),
};

/** Relógio congelado num instante — para testes e reprocessamentos determinísticos. */
export function fixedClock(instant: Date): Clock {
  const frozen = instant.getTime();
  return { now: () => new Date(frozen) };
}
