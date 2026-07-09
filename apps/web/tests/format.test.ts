import {
  centsToDecimalInput,
  dateInputToIso,
  formatCents,
  parseDecimalToCents,
  toDateInputValue,
} from '../src/lib/format';

describe('format — borda de apresentação usa Money do shared', () => {
  it('formata centavos como BRL', () => {
    expect(formatCents(123456).replace(/\u00A0/g, ' ')).toBe('R$ 1.234,56');
  });

  it('parse de entrada do usuário sem float (vírgula ou ponto)', () => {
    expect(parseDecimalToCents('123,45')).toBe(12345);
    expect(parseDecimalToCents('123.45')).toBe(12345);
    expect(() => parseDecimalToCents('abc')).toThrow();
  });

  it('round-trip centavos ↔ input decimal', () => {
    expect(centsToDecimalInput(250000)).toBe('2500,00');
    expect(parseDecimalToCents(centsToDecimalInput(987))).toBe(987);
  });

  it('datas: input date ↔ instante no fuso de SP', () => {
    expect(dateInputToIso('2026-07-08')).toBe('2026-07-08T03:00:00.000Z');
    expect(toDateInputValue(new Date('2026-07-09T02:59:00.000Z'))).toBe('2026-07-08');
  });
});
