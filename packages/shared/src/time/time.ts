/**
 * Time — fronteiras de dia/mês no fuso do domínio (DOMAIN_MODEL §2, ADR-005).
 *
 * Invariantes:
 * - armazenamento sempre em UTC (`Date`); fronteiras calculadas no fuso local;
 * - o fuso NUNCA vem da máquina: toda função usa `zone` explícito, com default
 *   DOMAIN_TIME_ZONE ('America/Sao_Paulo');
 * - implementação via Intl (IANA tz database) — sem dependências externas;
 * - horários locais inexistentes (gap de horário de verão histórico) avançam
 *   para o instante em que o dia efetivamente começou; horários ambíguos
 *   (fim do horário de verão) resolvem para a PRIMEIRA ocorrência.
 */

export const DOMAIN_TIME_ZONE = 'America/Sao_Paulo';

export interface MonthRef {
  year: number;
  /** 1–12 (janeiro = 1), como no restante do domínio. */
  month: number;
}

export interface LocalDate extends MonthRef {
  day: number;
}

export interface LocalDateTime extends LocalDate {
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(zone, formatter);
  }
  return formatter;
}

function assertValidInstant(instant: Date, operation: string): void {
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError(`Time.${operation}: instante inválido`);
  }
}

/** Data e hora locais (parede) de um instante UTC no fuso dado. */
export function localDateTimeOf(
  instant: Date,
  zone: string = DOMAIN_TIME_ZONE,
): Required<Omit<LocalDateTime, 'millisecond'>> {
  assertValidInstant(instant, 'localDateTimeOf');
  const fields = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const part of partsFormatter(zone).formatToParts(instant)) {
    if (part.type in fields) {
      fields[part.type as keyof typeof fields] = Number(part.value);
    }
  }
  return fields;
}

/** Data local (ano/mês/dia) de um instante UTC. */
export function localDateOf(instant: Date, zone: string = DOMAIN_TIME_ZONE): LocalDate {
  const { year, month, day } = localDateTimeOf(instant, zone);
  return { year, month, day };
}

/** `month`/`year` denormalizados na escrita (DOMAIN_MODEL §2 / DATABASE §1). */
export function monthYearOf(instant: Date, zone: string = DOMAIN_TIME_ZONE): MonthRef {
  const { year, month } = localDateOf(instant, zone);
  return { year, month };
}

/** Offset do fuso em ms num dado instante (positivo a leste de UTC). */
export function timeZoneOffsetMs(instant: Date, zone: string = DOMAIN_TIME_ZONE): number {
  const wall = localDateTimeOf(instant, zone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/** diasNoMes — puro calendário, independe de fuso. */
export function daysInMonth(year: number, month: number): number {
  assertMonth(month, 'daysInMonth');
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** dayOfMonth ajustado ao último dia em meses mais curtos (DOMAIN_MODEL §3.5). */
export function clampDayToMonth(year: number, month: number, day: number): number {
  if (!Number.isSafeInteger(day) || day < 1 || day > 31) {
    throw new RangeError('Time.clampDayToMonth: dia deve ser inteiro entre 1 e 31');
  }
  return Math.min(day, daysInMonth(year, month));
}

/** Aritmética de meses sobre referências {year, month} (virada de mês, parcelas). */
export function addMonths(ref: MonthRef, months: number): MonthRef {
  if (!Number.isSafeInteger(months)) {
    throw new TypeError('Time.addMonths: meses deve ser um inteiro');
  }
  assertMonth(ref.month, 'addMonths');
  const total = ref.year * 12 + (ref.month - 1) + months;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

/** Mesmo dia N meses depois, com clamp ao último dia (parcelas — DOMAIN_MODEL §6.1). */
export function addMonthsToLocalDate(date: LocalDate, months: number): LocalDate {
  const ref = addMonths({ year: date.year, month: date.month }, months);
  return { ...ref, day: clampDayToMonth(ref.year, ref.month, date.day) };
}

/**
 * Converte data/hora local (parede) no fuso para o instante UTC correspondente.
 * Gap (hora inexistente): avança para o instante real seguinte.
 * Ambíguo (hora que ocorre duas vezes): primeira ocorrência.
 */
export function localDateTimeToUtc(local: LocalDateTime, zone: string = DOMAIN_TIME_ZONE): Date {
  const { year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0 } = local;
  assertMonth(month, 'localDateTimeToUtc');
  if (!Number.isSafeInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError('Time.localDateTimeToUtc: dia inexistente no mês informado');
  }
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const first = new Date(naive - timeZoneOffsetMs(new Date(naive), zone));
  const second_ = new Date(naive - timeZoneOffsetMs(first, zone));
  const wanted = { year, month, day, hour, minute, second };
  if (wallMatches(second_, wanted, zone)) return second_;
  if (wallMatches(first, wanted, zone)) return first;
  return new Date(Math.max(first.getTime(), second_.getTime()));
}

/** Instante UTC em que o dia local começa (00:00 locais; avança em gaps de DST). */
export function startOfLocalDayUtc(date: LocalDate, zone: string = DOMAIN_TIME_ZONE): Date {
  return localDateTimeToUtc(date, zone);
}

/** Janela UTC [start, end) de um mês local — base das agregações mensais. */
export function monthRangeUtc(
  ref: MonthRef,
  zone: string = DOMAIN_TIME_ZONE,
): { start: Date; end: Date } {
  const next = addMonths(ref, 1);
  return {
    start: startOfLocalDayUtc({ ...ref, day: 1 }, zone),
    end: startOfLocalDayUtc({ ...next, day: 1 }, zone),
  };
}

/** diasDecorridos — inclui hoje (DOMAIN_MODEL §5). */
export function elapsedDaysInMonth(instant: Date, zone: string = DOMAIN_TIME_ZONE): number {
  return localDateOf(instant, zone).day;
}

/** diasRestantes = diasNoMes − diasDecorridos + 1 (DOMAIN_MODEL §5). */
export function remainingDaysInMonth(instant: Date, zone: string = DOMAIN_TIME_ZONE): number {
  const { year, month, day } = localDateOf(instant, zone);
  return daysInMonth(year, month) - day + 1;
}

/** Conveniência para os indicadores: diasNoMes, diasDecorridos e diasRestantes juntos. */
export function monthProgress(
  instant: Date,
  zone: string = DOMAIN_TIME_ZONE,
): { daysInMonth: number; elapsedDays: number; remainingDays: number } {
  const { year, month, day } = localDateOf(instant, zone);
  const total = daysInMonth(year, month);
  return { daysInMonth: total, elapsedDays: day, remainingDays: total - day + 1 };
}

/** Dois instantes caem no mesmo dia local? (auto-confirmação na data prevista). */
export function isSameLocalDay(a: Date, b: Date, zone: string = DOMAIN_TIME_ZONE): boolean {
  const da = localDateOf(a, zone);
  const db = localDateOf(b, zone);
  return da.year === db.year && da.month === db.month && da.day === db.day;
}

function assertMonth(month: number, operation: string): void {
  if (!Number.isSafeInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Time.${operation}: mês deve ser inteiro entre 1 e 12`);
  }
}

function wallMatches(
  candidate: Date,
  wanted: Required<Omit<LocalDateTime, 'millisecond'>>,
  zone: string,
): boolean {
  const wall = localDateTimeOf(candidate, zone);
  return (
    wall.year === wanted.year &&
    wall.month === wanted.month &&
    wall.day === wanted.day &&
    wall.hour === wanted.hour &&
    wall.minute === wanted.minute &&
    wall.second === wanted.second
  );
}
