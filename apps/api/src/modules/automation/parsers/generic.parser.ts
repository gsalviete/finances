import { Injectable } from '@nestjs/common';
import { Money } from '@finances/shared';
import type { NotificationParser, ParseResult } from './parser.interface';

/**
 * Parser GENÉRICO (ADR-008): extrai valor em reais ("R$ 45,99") e um candidato a
 * descrição de notificações bancárias em texto. Regras de honestidade (FR-028):
 * - nunca inventa valor: sem match, o campo simplesmente não existe;
 * - confiança reflete o quanto foi extraído (valor+descrição > só valor > nada).
 * O parser específico do Inter entra como fast-follow quando houver amostras reais.
 */
@Injectable()
export class GenericParser implements NotificationParser {
  readonly name = 'generic';

  parse(rawNotification: string): ParseResult {
    const amountCents = this.extractAmountCents(rawNotification);
    const description = this.extractDescription(rawNotification);

    if (amountCents === undefined) {
      return { parsedData: {}, confidence: 0.1 };
    }
    if (description === undefined) {
      return { parsedData: { amountCents }, confidence: 0.6 };
    }
    return { parsedData: { amountCents, description }, confidence: 0.9 };
  }

  private extractAmountCents(text: string): number | undefined {
    const match = /R\$\s?(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?/.exec(text);
    if (!match) return undefined;
    const whole = (match[1] ?? '').replace(/\./g, '');
    const cents = match[2] ?? '00';
    try {
      const value = Money.fromDecimalString(`${whole}.${cents}`).cents;
      return value > 0 ? value : undefined;
    } catch {
      return undefined;
    }
  }

  private extractDescription(text: string): string | undefined {
    // padrão comum: "... R$ 45,99 em MERCADO TAL" / "... no ESTABELECIMENTO"
    const match = /(?:\sem\s|\sno\s|\sna\s)([A-Z0-9][\w .*&-]{2,60})/.exec(text);
    const candidate = match?.[1]?.trim();
    return candidate && candidate.length >= 3 ? candidate : undefined;
  }
}
