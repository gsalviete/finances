import { Global, Module } from '@nestjs/common';
import { systemClock, type Clock } from '@finances/shared';

/** Token de injeção do relógio do domínio — serviços NUNCA leem o relógio direto. */
export const CLOCK = Symbol('CLOCK');

export type { Clock };

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }],
  exports: [CLOCK],
})
export class ClockModule {}
