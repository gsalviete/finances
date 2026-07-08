// Estes testes rodam com TZ=UTC (script de teste do package): toda expectativa
// sobre America/Sao_Paulo abaixo só passa se NADA depender do fuso da máquina.
import {
  addMonths,
  addMonthsToLocalDate,
  clampDayToMonth,
  daysInMonth,
  elapsedDaysInMonth,
  fixedClock,
  isSameLocalDay,
  localDateOf,
  localDateTimeToUtc,
  monthProgress,
  monthRangeUtc,
  monthYearOf,
  remainingDaysInMonth,
  startOfLocalDayUtc,
  systemClock,
  timeZoneOffsetMs,
} from '../src';

const HOUR = 3_600_000;

describe('Time — fuso da máquina não interfere', () => {
  it('a suíte roda em TZ=UTC (pré-condição destes testes)', () => {
    expect(process.env.TZ).toBe('UTC');
  });

  it('aceita fuso explícito diferente do default', () => {
    const instant = new Date('2026-07-08T23:30:00Z');
    expect(monthYearOf(instant, 'UTC')).toEqual({ year: 2026, month: 7 });
    expect(localDateOf(instant, 'Asia/Tokyo')).toEqual({ year: 2026, month: 7, day: 9 });
  });
});

describe('Time — fronteira de mês no fuso local (aceite da Fase 5)', () => {
  it('23h59 do último dia do mês em SP pertence ao mês local, não ao mês UTC', () => {
    // 2026-01-31T23:59 em SP == 2026-02-01T02:59Z (offset -03)
    const instant = new Date('2026-02-01T02:59:00Z');
    expect(monthYearOf(instant)).toEqual({ year: 2026, month: 1 });
    expect(localDateOf(instant)).toEqual({ year: 2026, month: 1, day: 31 });
  });

  it('00h00 do dia 1º em SP inicia o novo mês local', () => {
    const instant = new Date('2026-02-01T03:00:00Z');
    expect(monthYearOf(instant)).toEqual({ year: 2026, month: 2 });
  });

  it('virada de ano: 31/12 23h59 em SP ainda é dezembro do ano anterior', () => {
    const instant = new Date('2027-01-01T02:59:59Z');
    expect(monthYearOf(instant)).toEqual({ year: 2026, month: 12 });
  });
});

describe('Time — calendário (fevereiro, bissextos, meses curtos)', () => {
  it.each([
    [2024, 2, 29], // bissexto
    [2025, 2, 28],
    [2000, 2, 29], // divisível por 400: bissexto
    [2100, 2, 28], // divisível por 100 mas não por 400: não bissexto
    [2026, 1, 31],
    [2026, 4, 30],
    [2026, 12, 31],
  ])('daysInMonth(%i, %i) == %i', (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days);
  });

  it('rejeita mês inválido', () => {
    expect(() => daysInMonth(2026, 0)).toThrow(RangeError);
    expect(() => daysInMonth(2026, 13)).toThrow(RangeError);
  });

  it('clampDayToMonth ajusta ao último dia (DOMAIN_MODEL §3.5)', () => {
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);
    expect(clampDayToMonth(2024, 2, 31)).toBe(29);
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);
    expect(clampDayToMonth(2026, 1, 31)).toBe(31);
    expect(clampDayToMonth(2026, 2, 10)).toBe(10);
    expect(() => clampDayToMonth(2026, 2, 0)).toThrow(RangeError);
    expect(() => clampDayToMonth(2026, 2, 32)).toThrow(RangeError);
  });
});

describe('Time — aritmética de meses', () => {
  it('addMonths atravessa anos nos dois sentidos', () => {
    expect(addMonths({ year: 2026, month: 1 }, 1)).toEqual({ year: 2026, month: 2 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 3 }, 25)).toEqual({ year: 2028, month: 4 });
    expect(addMonths({ year: 2026, month: 3 }, -27)).toEqual({ year: 2023, month: 12 });
    expect(addMonths({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 });
  });

  it('rejeita quantidade de meses não inteira e referência inválida', () => {
    expect(() => addMonths({ year: 2026, month: 1 }, 1.5)).toThrow(TypeError);
    expect(() => addMonths({ year: 2026, month: 0 }, 1)).toThrow(RangeError);
  });

  it('addMonthsToLocalDate mantém o dia com clamp (parcelas §6.1)', () => {
    expect(addMonthsToLocalDate({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(addMonthsToLocalDate({ year: 2024, month: 1, day: 31 }, 1)).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    expect(addMonthsToLocalDate({ year: 2026, month: 1, day: 15 }, 3)).toEqual({
      year: 2026,
      month: 4,
      day: 15,
    });
    // o clamp não é "pegajoso": referência é a data informada, não a anterior
    expect(addMonthsToLocalDate({ year: 2026, month: 1, day: 31 }, 2)).toEqual({
      year: 2026,
      month: 3,
      day: 31,
    });
  });
});

describe('Time — conversão local → UTC (offsets e horário de verão histórico)', () => {
  it('offset padrão de SP é -03', () => {
    expect(timeZoneOffsetMs(new Date('2026-07-08T12:00:00Z'))).toBe(-3 * HOUR);
    expect(timeZoneOffsetMs(new Date('2019-12-01T12:00:00Z'))).toBe(-3 * HOUR); // DST abolido em 2019
  });

  it('offset durante horário de verão histórico era -02', () => {
    expect(timeZoneOffsetMs(new Date('2018-12-01T12:00:00Z'))).toBe(-2 * HOUR);
  });

  it('meia-noite local vira 03:00Z (ou 02:00Z sob DST histórico)', () => {
    expect(localDateTimeToUtc({ year: 2026, month: 7, day: 8 }).toISOString()).toBe(
      '2026-07-08T03:00:00.000Z',
    );
    expect(localDateTimeToUtc({ year: 2018, month: 12, day: 15 }).toISOString()).toBe(
      '2018-12-15T02:00:00.000Z',
    );
  });

  it('hora local inexistente (gap do DST 2018) avança para o início real do dia', () => {
    // Em 2018-11-04, 00:00 não existiu em SP (00:00 → 01:00)
    const start = startOfLocalDayUtc({ year: 2018, month: 11, day: 4 });
    expect(start.toISOString()).toBe('2018-11-04T03:00:00.000Z');
    expect(localDateOf(start)).toEqual({ year: 2018, month: 11, day: 4 });
  });

  it('hora local ambígua (fim do DST 2019) resolve para a primeira ocorrência', () => {
    // 2019-02-16 23:30 ocorreu duas vezes: 01:30Z (-02) e 02:30Z (-03)
    const instant = localDateTimeToUtc({ year: 2019, month: 2, day: 16, hour: 23, minute: 30 });
    expect(instant.toISOString()).toBe('2019-02-17T01:30:00.000Z');
  });

  it('rejeita datas locais inexistentes no calendário', () => {
    expect(() => localDateTimeToUtc({ year: 2026, month: 2, day: 30 })).toThrow(RangeError);
    expect(() => localDateTimeToUtc({ year: 2026, month: 13, day: 1 })).toThrow(RangeError);
  });

  it('instante inválido é rejeitado', () => {
    expect(() => localDateOf(new Date(NaN))).toThrow(TypeError);
  });
});

describe('Time — janela UTC do mês local', () => {
  it('mês comum: [dia 1 00:00 local, dia 1 do mês seguinte 00:00 local)', () => {
    const { start, end } = monthRangeUtc({ year: 2026, month: 7 });
    expect(start.toISOString()).toBe('2026-07-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-01T03:00:00.000Z');
  });

  it('mês que cruza transição de DST histórico tem bordas com offsets distintos', () => {
    const { start, end } = monthRangeUtc({ year: 2018, month: 11 });
    expect(start.toISOString()).toBe('2018-11-01T03:00:00.000Z'); // -03 antes do DST
    expect(end.toISOString()).toBe('2018-12-01T02:00:00.000Z'); // -02 durante o DST
  });

  it('a fronteira é exclusiva no fim: 02:59Z pertence ao mês, 03:00Z não', () => {
    const { start, end } = monthRangeUtc({ year: 2026, month: 1 });
    const lastMoment = new Date('2026-02-01T02:59:59.999Z');
    expect(lastMoment.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(lastMoment.getTime()).toBeLessThan(end.getTime());
    expect(end.getTime()).toBe(new Date('2026-02-01T03:00:00Z').getTime());
  });
});

describe('Time — dias decorridos/restantes (DOMAIN_MODEL §5)', () => {
  it('inclui hoje em diasDecorridos; diasRestantes = diasNoMes − decorridos + 1', () => {
    const midMonth = new Date('2026-07-08T12:00:00Z'); // 8 de julho local
    expect(elapsedDaysInMonth(midMonth)).toBe(8);
    expect(remainingDaysInMonth(midMonth)).toBe(24); // 31 − 8 + 1
  });

  it('primeiro e último dia do mês', () => {
    const firstDay = new Date('2026-07-01T03:00:00Z');
    expect(elapsedDaysInMonth(firstDay)).toBe(1);
    expect(remainingDaysInMonth(firstDay)).toBe(31);

    const lastDay = new Date('2026-08-01T02:59:00Z'); // 31/07 23:59 local
    expect(elapsedDaysInMonth(lastDay)).toBe(31);
    expect(remainingDaysInMonth(lastDay)).toBe(1);
  });

  it('monthProgress é consistente: decorridos + restantes == diasNoMes + 1', () => {
    for (const iso of [
      '2026-02-15T12:00:00Z',
      '2024-02-29T12:00:00Z',
      '2026-07-01T03:00:00Z',
      '2026-08-01T02:59:00Z',
    ]) {
      const progress = monthProgress(new Date(iso));
      expect(progress.elapsedDays + progress.remainingDays).toBe(progress.daysInMonth + 1);
    }
  });
});

describe('Time — mesmo dia local', () => {
  it('instantes UTC de dias diferentes podem ser o mesmo dia local', () => {
    const night = new Date('2026-07-09T02:59:00Z'); // 08/07 23:59 local
    const noon = new Date('2026-07-08T15:00:00Z'); // 08/07 12:00 local
    expect(isSameLocalDay(night, noon)).toBe(true);
    expect(isSameLocalDay(new Date('2026-07-09T03:00:00Z'), noon)).toBe(false);
  });
});

describe('Clock', () => {
  it('fixedClock congela o instante (determinismo de testes e reprocessos)', () => {
    const instant = new Date('2026-07-08T12:00:00Z');
    const clock = fixedClock(instant);
    expect(clock.now().getTime()).toBe(instant.getTime());
    expect(clock.now()).not.toBe(instant); // cópia defensiva, não a mesma referência
  });

  it('systemClock devolve um Date válido', () => {
    expect(Number.isNaN(systemClock.now().getTime())).toBe(false);
  });
});
