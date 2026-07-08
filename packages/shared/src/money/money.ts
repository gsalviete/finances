/**
 * Money — value object de dinheiro em centavos inteiros (DOMAIN_MODEL §2, ADR-004).
 *
 * Invariantes:
 * - o valor interno é SEMPRE um inteiro seguro (Number.isSafeInteger) de centavos;
 * - nenhuma operação usa float internamente; formatação decompõe o inteiro;
 * - operações que estourariam a faixa segura lançam RangeError (nunca silenciam);
 * - instâncias são imutáveis: toda operação retorna um novo Money.
 *
 * O sinal do valor no domínio vem do `type` da transação (INCOME/EXPENSE); ainda
 * assim Money suporta negativos porque agregações (saldos) podem ser negativas.
 */

const DECIMAL_INPUT = /^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/;

function assertSafeCents(cents: number, operation: string): number {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Money.${operation}: resultado fora da faixa segura de centavos inteiros`);
  }
  return cents;
}

export class Money {
  private readonly _cents: number;

  private constructor(cents: number) {
    // normaliza -0 → 0 (negate/multiply de zero nunca produzem zero negativo)
    this._cents = cents === 0 ? 0 : cents;
  }

  /** Cria a partir de centavos inteiros (única representação canônica). */
  static fromCents(cents: number): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new RangeError('Money.fromCents: centavos devem ser um inteiro seguro');
    }
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  /**
   * Parse de string decimal ("1234.56" ou "1234,56", até 2 casas, sem separador
   * de milhar). Feito por decomposição de string — nenhum float envolvido.
   */
  static fromDecimalString(input: string): Money {
    const match = DECIMAL_INPUT.exec(input.trim());
    if (!match) {
      throw new TypeError(`Money.fromDecimalString: valor decimal inválido: "${input}"`);
    }
    const [, sign, wholeRaw, fracRaw = ''] = match;
    const whole = Number(wholeRaw);
    const frac = Number(fracRaw.padEnd(2, '0'));
    if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(whole * 100)) {
      throw new RangeError('Money.fromDecimalString: valor fora da faixa segura de centavos');
    }
    const cents = whole * 100 + frac;
    return new Money(assertSafeCents(sign === '-' ? -cents : cents, 'fromDecimalString'));
  }

  static sum(values: readonly Money[]): Money {
    return values.reduce((acc, value) => acc.add(value), Money.zero());
  }

  get cents(): number {
    return this._cents;
  }

  add(other: Money): Money {
    return new Money(assertSafeCents(this._cents + other._cents, 'add'));
  }

  subtract(other: Money): Money {
    return new Money(assertSafeCents(this._cents - other._cents, 'subtract'));
  }

  /** Multiplicação por inteiro (ex.: quantidade). Fatores fracionários são proibidos. */
  multiply(factor: number): Money {
    if (!Number.isSafeInteger(factor)) {
      throw new TypeError('Money.multiply: fator deve ser um inteiro seguro');
    }
    return new Money(assertSafeCents(this._cents * factor, 'multiply'));
  }

  negate(): Money {
    return new Money(-this._cents);
  }

  abs(): Money {
    return this._cents < 0 ? this.negate() : this;
  }

  equals(other: Money): boolean {
    return this._cents === other._cents;
  }

  /** -1 | 0 | 1, para ordenação. */
  compare(other: Money): number {
    if (this._cents < other._cents) return -1;
    if (this._cents > other._cents) return 1;
    return 0;
  }

  greaterThan(other: Money): boolean {
    return this._cents > other._cents;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this._cents >= other._cents;
  }

  lessThan(other: Money): boolean {
    return this._cents < other._cents;
  }

  lessThanOrEqual(other: Money): boolean {
    return this._cents <= other._cents;
  }

  isZero(): boolean {
    return this._cents === 0;
  }

  isNegative(): boolean {
    return this._cents < 0;
  }

  isPositive(): boolean {
    return this._cents > 0;
  }

  /**
   * Divisão exata em N partes (DOMAIN_MODEL §6.1): base = floor(total/N); as
   * primeiras `resto` partes recebem base+1. Garante Σ partes == total.
   * Definida apenas para valores não-negativos (o domínio divide magnitudes).
   */
  splitEvenly(parts: number): Money[] {
    if (!Number.isSafeInteger(parts) || parts < 1) {
      throw new TypeError('Money.splitEvenly: número de partes deve ser inteiro >= 1');
    }
    if (this._cents < 0) {
      throw new RangeError('Money.splitEvenly: divisão definida apenas para valores não-negativos');
    }
    const remainder = this._cents % parts;
    const base = (this._cents - remainder) / parts;
    return Array.from({ length: parts }, (_, i) => new Money(i < remainder ? base + 1 : base));
  }

  /** Representação decimal neutra com ponto e 2 casas (ex.: "-1234.56"). */
  toDecimalString(): string {
    const abs = this._cents < 0 ? -this._cents : this._cents;
    const frac = abs % 100;
    const whole = (abs - frac) / 100;
    const sign = this._cents < 0 ? '-' : '';
    return `${sign}${whole}.${String(frac).padStart(2, '0')}`;
  }

  /**
   * Formatação para exibição (borda do sistema). O valor é decomposto em
   * inteiro/fração por aritmética inteira; Intl fornece apenas o layout do
   * locale (símbolo, separadores, posição do sinal) — nunca arredonda o valor.
   */
  format(locale = 'pt-BR', currency = 'BRL'): string {
    const negative = this._cents < 0;
    const abs = negative ? -this._cents : this._cents;
    const fracPart = abs % 100;
    const whole = (abs - fracPart) / 100;
    const groupedWhole = new Intl.NumberFormat(locale, { useGrouping: true }).format(whole);
    const template = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(negative ? -1 : 1);
    return template
      .map((part) => {
        if (part.type === 'integer') return groupedWhole;
        if (part.type === 'fraction') return String(fracPart).padStart(2, '0');
        return part.value;
      })
      .join('');
  }

  /** Serializa como centavos inteiros (representação canônica de persistência/transporte). */
  toJSON(): number {
    return this._cents;
  }

  toString(): string {
    return this.toDecimalString();
  }
}
