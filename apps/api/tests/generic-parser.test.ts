import { GenericParser } from '../src/modules/automation/parsers/generic.parser';

describe('GenericParser (ADR-008) — nunca inventa valores', () => {
  const parser = new GenericParser();

  it('extrai valor e estabelecimento: confiança alta', () => {
    const result = parser.parse('Compra aprovada: R$ 45,99 em MERCADO PAGUE MENOS');
    expect(result.parsedData.amountCents).toBe(4599);
    expect(result.parsedData.description).toBe('MERCADO PAGUE MENOS');
    expect(result.confidence).toBe(0.9);
  });

  it('valor com separador de milhar', () => {
    const result = parser.parse('Você pagou R$ 1.234,56 no POSTO SHELL');
    expect(result.parsedData.amountCents).toBe(123456);
    expect(result.parsedData.description).toBe('POSTO SHELL');
  });

  it('valor sem centavos', () => {
    expect(parser.parse('PIX de R$ 200 enviado').parsedData.amountCents).toBe(20000);
  });

  it('só valor, sem estabelecimento: confiança média', () => {
    const result = parser.parse('Débito de R$ 12,50');
    expect(result.parsedData.amountCents).toBe(1250);
    expect(result.parsedData.description).toBeUndefined();
    expect(result.confidence).toBe(0.6);
  });

  it('sem valor identificável: NADA é inventado, confiança baixa (FR-028)', () => {
    const result = parser.parse('Seu cartão foi utilizado agora há pouco');
    expect(result.parsedData).toEqual({});
    expect(result.confidence).toBe(0.1);
  });
});
