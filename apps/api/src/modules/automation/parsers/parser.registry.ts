import { Injectable } from '@nestjs/common';
import { GenericParser } from './generic.parser';
import type { NotificationParser } from './parser.interface';

/**
 * Preparado para múltiplos bancos SEM alterar o contrato da Inbox (ADR-008);
 * na V1 exatamente UM parser está ativo.
 */
@Injectable()
export class ParserRegistry {
  constructor(private readonly generic: GenericParser) {}

  get active(): NotificationParser {
    return this.generic;
  }
}
