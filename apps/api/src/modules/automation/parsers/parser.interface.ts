import type { ParsedNotification } from '@finances/shared';

export interface ParseResult {
  parsedData: ParsedNotification;
  /** 0–1; abaixo do threshold a UI marca "revisar". NUNCA inventa valores. */
  confidence: number;
}

/** Contrato de parser (ADR-008): um único ativo na V1; registry preparado p/ mais. */
export interface NotificationParser {
  readonly name: string;
  parse(rawNotification: string): ParseResult;
}
