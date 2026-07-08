/**
 * Função de sinal usada em TODA agregação (DOMAIN_MODEL §2):
 *   signed(t) = +amountCents se INCOME · −amountCents se EXPENSE
 */
import type { TransactionType } from '../enums';
import { Money } from './money';

export interface SignedInput {
  type: TransactionType;
  amountCents: number;
}

/** Valor com sinal em centavos, a partir da magnitude + type. */
export function signedCents({ type, amountCents }: SignedInput): number {
  const magnitude = Money.fromCents(amountCents); // valida inteiro seguro
  return type === 'INCOME' ? magnitude.cents : magnitude.negate().cents;
}

/** Versão que devolve Money — para composição com Money.sum em agregações. */
export function signedMoney(input: SignedInput): Money {
  return Money.fromCents(signedCents(input));
}
