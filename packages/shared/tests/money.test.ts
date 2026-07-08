import { Money } from '../src';

const MAX = Number.MAX_SAFE_INTEGER;

describe('Money — construção e validação', () => {
  it('cria a partir de centavos inteiros', () => {
    expect(Money.fromCents(123456).cents).toBe(123456);
    expect(Money.fromCents(-1).cents).toBe(-1);
    expect(Money.fromCents(0).cents).toBe(0);
    expect(Money.fromCents(MAX).cents).toBe(MAX);
  });

  it('rejeita centavos não inteiros ou fora da faixa segura', () => {
    expect(() => Money.fromCents(1.5)).toThrow(RangeError);
    expect(() => Money.fromCents(NaN)).toThrow(RangeError);
    expect(() => Money.fromCents(Infinity)).toThrow(RangeError);
    expect(() => Money.fromCents(MAX + 1)).toThrow(RangeError);
  });

  it('zero() é 0 centavos', () => {
    expect(Money.zero().cents).toBe(0);
    expect(Money.zero().isZero()).toBe(true);
  });
});

describe('Money — parse decimal (sem float)', () => {
  it.each([
    ['1234.56', 123456],
    ['1234,56', 123456],
    ['0.5', 50],
    ['0,05', 5],
    ['10', 1000],
    ['-3.07', -307],
    ['+1.00', 100],
    ['0', 0],
  ])('parseia "%s" como %i centavos', (input, cents) => {
    expect(Money.fromDecimalString(input).cents).toBe(cents);
  });

  it('0.1 + 0.2 == 0.3 exatamente (aceite da Fase 5)', () => {
    const result = Money.fromDecimalString('0.1').add(Money.fromDecimalString('0.2'));
    expect(result.equals(Money.fromDecimalString('0.3'))).toBe(true);
    expect(result.cents).toBe(30);
  });

  it('rejeita entradas inválidas', () => {
    for (const bad of ['', 'abc', '1.234,56', '1,234.56', '1.999', '--1', '1.', ',5', '1e3']) {
      expect(() => Money.fromDecimalString(bad)).toThrow();
    }
  });

  it('rejeita valores acima da faixa segura', () => {
    expect(() => Money.fromDecimalString('99999999999999999999')).toThrow(RangeError);
  });
});

describe('Money — aritmética', () => {
  it('soma e subtrai exatamente', () => {
    expect(Money.fromCents(100).add(Money.fromCents(250)).cents).toBe(350);
    expect(Money.fromCents(100).subtract(Money.fromCents(250)).cents).toBe(-150);
  });

  it('é imutável: operações retornam novas instâncias', () => {
    const a = Money.fromCents(100);
    const b = a.add(Money.fromCents(1));
    expect(a.cents).toBe(100);
    expect(b.cents).toBe(101);
  });

  it('multiplica apenas por inteiros', () => {
    expect(Money.fromCents(333).multiply(3).cents).toBe(999);
    expect(Money.fromCents(100).multiply(0).cents).toBe(0);
    expect(Money.fromCents(100).multiply(-2).cents).toBe(-200);
    expect(() => Money.fromCents(100).multiply(1.5)).toThrow(TypeError);
    expect(() => Money.fromCents(100).multiply(NaN)).toThrow(TypeError);
  });

  it('negate e abs', () => {
    expect(Money.fromCents(100).negate().cents).toBe(-100);
    expect(Money.fromCents(-100).abs().cents).toBe(100);
    expect(Money.fromCents(100).abs().cents).toBe(100);
    expect(Money.zero().negate().cents).toBe(0);
  });

  it('sum agrega lista (lista vazia = zero)', () => {
    const total = Money.sum([Money.fromCents(1), Money.fromCents(2), Money.fromCents(-3)]);
    expect(total.cents).toBe(0);
    expect(Money.sum([]).cents).toBe(0);
  });

  it('estouro da faixa segura lança RangeError (nunca silencia)', () => {
    expect(() => Money.fromCents(MAX).add(Money.fromCents(1))).toThrow(RangeError);
    expect(() => Money.fromCents(-MAX).subtract(Money.fromCents(2))).toThrow(RangeError);
    expect(() => Money.fromCents(MAX).multiply(2)).toThrow(RangeError);
  });
});

describe('Money — comparação', () => {
  const smaller = Money.fromCents(100);
  const bigger = Money.fromCents(200);

  it('equals / compare', () => {
    expect(smaller.equals(Money.fromCents(100))).toBe(true);
    expect(smaller.equals(bigger)).toBe(false);
    expect(smaller.compare(bigger)).toBe(-1);
    expect(bigger.compare(smaller)).toBe(1);
    expect(smaller.compare(Money.fromCents(100))).toBe(0);
  });

  it('operadores relacionais', () => {
    expect(smaller.lessThan(bigger)).toBe(true);
    expect(smaller.lessThanOrEqual(Money.fromCents(100))).toBe(true);
    expect(bigger.greaterThan(smaller)).toBe(true);
    expect(bigger.greaterThanOrEqual(Money.fromCents(200))).toBe(true);
  });

  it('sinais', () => {
    expect(Money.fromCents(-1).isNegative()).toBe(true);
    expect(Money.fromCents(1).isPositive()).toBe(true);
    expect(Money.zero().isNegative()).toBe(false);
    expect(Money.zero().isPositive()).toBe(false);
  });
});

describe('Money — splitEvenly (DOMAIN_MODEL §6.1)', () => {
  it('divide com as primeiras `resto` partes recebendo base+1', () => {
    expect(
      Money.fromCents(10000)
        .splitEvenly(3)
        .map((m) => m.cents),
    ).toEqual([3334, 3333, 3333]);
    expect(
      Money.fromCents(100)
        .splitEvenly(3)
        .map((m) => m.cents),
    ).toEqual([34, 33, 33]);
    expect(
      Money.fromCents(1)
        .splitEvenly(3)
        .map((m) => m.cents),
    ).toEqual([1, 0, 0]);
    expect(
      Money.fromCents(0)
        .splitEvenly(4)
        .map((m) => m.cents),
    ).toEqual([0, 0, 0, 0]);
    expect(
      Money.fromCents(500)
        .splitEvenly(1)
        .map((m) => m.cents),
    ).toEqual([500]);
  });

  it.each([
    [10000, 3],
    [99999, 7],
    [1, 12],
    [123456789, 11],
    [MAX, 7],
  ])('Σ partes == total exatamente (%i em %i partes)', (cents, parts) => {
    const split = Money.fromCents(cents).splitEvenly(parts);
    expect(split).toHaveLength(parts);
    expect(Money.sum(split).cents).toBe(cents);
    const values = split.map((m) => m.cents);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it('rejeita número de partes inválido e valores negativos', () => {
    expect(() => Money.fromCents(100).splitEvenly(0)).toThrow(TypeError);
    expect(() => Money.fromCents(100).splitEvenly(-1)).toThrow(TypeError);
    expect(() => Money.fromCents(100).splitEvenly(2.5)).toThrow(TypeError);
    expect(() => Money.fromCents(-100).splitEvenly(2)).toThrow(RangeError);
  });
});

describe('Money — serialização', () => {
  it('toJSON serializa como centavos inteiros', () => {
    expect(Money.fromCents(123456).toJSON()).toBe(123456);
    expect(JSON.stringify({ amount: Money.fromCents(-307) })).toBe('{"amount":-307}');
  });

  it('toDecimalString com 2 casas e sinal', () => {
    expect(Money.fromCents(123456).toDecimalString()).toBe('1234.56');
    expect(Money.fromCents(-5).toDecimalString()).toBe('-0.05');
    expect(Money.fromCents(0).toDecimalString()).toBe('0.00');
    expect(Money.fromCents(100).toDecimalString()).toBe('1.00');
  });

  it('toString delega para a representação decimal', () => {
    expect(String(Money.fromCents(-5))).toBe('-0.05');
  });

  it('round-trip fromDecimalString ↔ toDecimalString', () => {
    for (const cents of [0, 1, -1, 99, 100, 123456, -987654321]) {
      const money = Money.fromCents(cents);
      expect(Money.fromDecimalString(money.toDecimalString()).cents).toBe(cents);
    }
  });
});

describe('Money — formatação (borda, sem arredondar valor)', () => {
  const plain = (s: string) => s.replace(/\u00A0/g, ' ');

  it('pt-BR / BRL', () => {
    expect(plain(Money.fromCents(123456).format())).toBe('R$ 1.234,56');
    expect(plain(Money.fromCents(-123456).format())).toBe('-R$ 1.234,56');
    expect(plain(Money.zero().format())).toBe('R$ 0,00');
    expect(plain(Money.fromCents(5).format())).toBe('R$ 0,05');
  });

  it('valores muito altos formatam exatamente (onde float falharia)', () => {
    expect(plain(Money.fromCents(MAX).format())).toBe('R$ 90.071.992.547.409,91');
  });

  it('outros locales/moedas', () => {
    expect(Money.fromCents(123456).format('en-US', 'USD')).toBe('$1,234.56');
  });
});
