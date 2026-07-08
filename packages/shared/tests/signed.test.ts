import { Money, signedCents, signedMoney } from '../src';

describe('signed — função de sinal de toda agregação (DOMAIN_MODEL §2)', () => {
  it('INCOME é positivo; EXPENSE é negativo', () => {
    expect(signedCents({ type: 'INCOME', amountCents: 4599 })).toBe(4599);
    expect(signedCents({ type: 'EXPENSE', amountCents: 4599 })).toBe(-4599);
  });

  it('signedMoney compõe com Money.sum (agregação líquida)', () => {
    const net = Money.sum([
      signedMoney({ type: 'INCOME', amountCents: 500000 }),
      signedMoney({ type: 'EXPENSE', amountCents: 250000 }),
      signedMoney({ type: 'EXPENSE', amountCents: 4599 }),
    ]);
    expect(net.cents).toBe(245401);
  });

  it('valida a magnitude (inteiro seguro) antes de aplicar o sinal', () => {
    expect(() => signedCents({ type: 'EXPENSE', amountCents: 10.5 })).toThrow(RangeError);
  });
});
