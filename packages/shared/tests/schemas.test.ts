import { z } from 'zod';
import {
  backupMetadataSchema,
  categorySchema,
  draftTransactionSchema,
  monthlyPlanItemSchema,
  monthlyPlanSchema,
  recurringRuleSchema,
  safeUserSchema,
  settingsSchema,
  transactionSchema,
  userSchema,
} from '../src';

const oid = (seed: string) => seed.repeat(24).slice(0, 24);

const firstMessage = (result: z.ZodSafeParseResult<unknown>): string => {
  if (result.success) throw new Error('esperava falha de validação');
  return result.error.issues[0]?.message ?? '';
};

// ---------- fixtures válidas (base de todos os testes) ----------

const validTransaction = () => ({
  id: oid('a'),
  userId: oid('b'),
  categoryId: oid('c'),
  type: 'EXPENSE',
  status: 'CONFIRMED',
  amountCents: 4599,
  description: 'Mercado',
  date: '2026-07-08T15:00:00.000Z',
  month: 7,
  year: 2026,
  origin: 'MANUAL',
  linkedPlanItemId: null,
  installmentGroupId: null,
  installmentNumber: null,
  installmentTotal: null,
  deletedAt: null,
  deletedBy: null,
  createdAt: '2026-07-08T15:00:00.000Z',
  updatedAt: '2026-07-08T15:00:00.000Z',
});

const validCategory = () => ({
  id: oid('a'),
  userId: oid('b'),
  name: 'Mercado',
  icon: 'shopping-cart',
  color: 'category.green',
  active: true,
  archived: false,
  sortOrder: 0,
  expiresAt: null,
  deletedAt: null,
  deletedBy: null,
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
});

const validPlanItem = () => ({
  id: oid('d'),
  kind: 'EXPENSE',
  description: 'Aluguel',
  amountCents: 250000,
  categoryId: oid('c'),
  status: 'PENDING',
  linkedTransactionId: null,
});

const validMonthlyPlan = () => ({
  id: oid('a'),
  userId: oid('b'),
  month: 7,
  year: 2026,
  archived: false,
  notes: '',
  monthlyPlanItems: [validPlanItem()],
  createdAt: '2026-07-01T03:00:00.000Z',
  updatedAt: '2026-07-01T03:00:00.000Z',
});

const validRecurringRule = () => ({
  id: oid('a'),
  userId: oid('b'),
  type: 'EXPENSE',
  investment: false,
  description: 'Aluguel',
  categoryId: oid('c'),
  amountCents: 250000,
  recurrenceType: 'MONTHLY',
  dayOfMonth: 5,
  startDate: '2026-01-01T03:00:00.000Z',
  endDate: null,
  active: true,
  deletedAt: null,
  deletedBy: null,
  createdAt: '2026-01-01T03:00:00.000Z',
  updatedAt: '2026-01-01T03:00:00.000Z',
});

const validDraft = () => ({
  id: oid('a'),
  userId: oid('b'),
  rawNotification: 'Compra aprovada no cartão final 1234: R$ 45,99 em MERCADO X',
  parsedData: { amountCents: 4599, description: 'MERCADO X' },
  confidence: 0.92,
  status: 'PENDING',
  clientEventId: 'shortcut-2026-07-08-001',
  createdAt: '2026-07-08T15:00:00.000Z',
  confirmedAt: null,
});

const validSettings = () => ({
  id: oid('a'),
  userId: oid('b'),
  theme: 'system',
  currency: 'BRL',
  language: 'pt-BR',
  timezone: 'America/Sao_Paulo',
  backupFrequency: 'WEEKLY',
  animationsEnabled: true,
  motionLevel: 'FULL',
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
});

const validUser = () => ({
  id: oid('a'),
  name: 'Gabriel',
  email: 'gsalviete@gmail.com',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$abc$def',
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
});

const validBackup = () => ({
  id: oid('a'),
  userId: oid('b'),
  location: 's3://finances-backups/2026-07-08.zip',
  providerType: 'OBJECT_STORAGE',
  sizeBytes: 10240,
  checksum: 'sha256:abcdef',
  createdAt: '2026-07-08T15:00:00.000Z',
});

// ---------- Transaction ----------

describe('transactionSchema', () => {
  it('aceita transação válida e coage datas ISO para Date', () => {
    const parsed = transactionSchema.parse(validTransaction());
    expect(parsed.date).toBeInstanceOf(Date);
    expect(parsed.amountCents).toBe(4599);
    expect(parsed.status).toBe('CONFIRMED');
  });

  it('aceita parcelamento completo e consistente', () => {
    const parsed = transactionSchema.parse({
      ...validTransaction(),
      status: 'FORECAST',
      installmentGroupId: oid('e'),
      installmentNumber: 2,
      installmentTotal: 10,
    });
    expect(parsed.installmentNumber).toBe(2);
  });

  it('rejeita amountCents zero, negativo, fracionário e não seguro', () => {
    for (const amountCents of [0, -100, 10.5, Number.MAX_SAFE_INTEGER + 1]) {
      const result = transactionSchema.safeParse({ ...validTransaction(), amountCents });
      expect(result.success).toBe(false);
    }
    const zero = transactionSchema.safeParse({ ...validTransaction(), amountCents: 0 });
    expect(firstMessage(zero)).toBe('amountCents deve ser maior que zero');
  });

  it('rejeita categoria ausente ou inválida (FR-015)', () => {
    const { categoryId: _categoryId, ...withoutCategory } = validTransaction();
    expect(transactionSchema.safeParse(withoutCategory).success).toBe(false);
    const bad = transactionSchema.safeParse({ ...validTransaction(), categoryId: 'x' });
    expect(firstMessage(bad)).toBe('id deve ser um ObjectId (24 caracteres hexadecimais)');
  });

  it('rejeita enums fora do contrato', () => {
    expect(transactionSchema.safeParse({ ...validTransaction(), type: 'TRANSFER' }).success).toBe(
      false,
    );
    expect(transactionSchema.safeParse({ ...validTransaction(), status: 'PENDING' }).success).toBe(
      false,
    );
    expect(transactionSchema.safeParse({ ...validTransaction(), origin: 'API' }).success).toBe(
      false,
    );
  });

  it('rejeita month/year fora do intervalo e data inválida', () => {
    expect(transactionSchema.safeParse({ ...validTransaction(), month: 13 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...validTransaction(), month: 0 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...validTransaction(), year: 1969 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...validTransaction(), date: 'não-é-data' }).success).toBe(
      false,
    );
  });

  it('rejeita parcelamento parcial (campos devem vir todos juntos)', () => {
    const result = transactionSchema.safeParse({
      ...validTransaction(),
      installmentNumber: 2,
    });
    expect(firstMessage(result)).toContain('devem vir todos juntos ou nenhum');
  });

  it('rejeita installmentNumber > installmentTotal', () => {
    const result = transactionSchema.safeParse({
      ...validTransaction(),
      installmentGroupId: oid('e'),
      installmentNumber: 11,
      installmentTotal: 10,
    });
    expect(firstMessage(result)).toBe('installmentNumber não pode ser maior que installmentTotal');
  });
});

// ---------- Category ----------

describe('categorySchema', () => {
  it('aceita categoria válida', () => {
    expect(categorySchema.parse(validCategory()).name).toBe('Mercado');
  });

  it('rejeita nome vazio (após trim), ícone e cor vazios', () => {
    expect(firstMessage(categorySchema.safeParse({ ...validCategory(), name: '   ' }))).toBe(
      'nome da categoria é obrigatório',
    );
    expect(categorySchema.safeParse({ ...validCategory(), icon: '' }).success).toBe(false);
    expect(categorySchema.safeParse({ ...validCategory(), color: '' }).success).toBe(false);
  });

  it('rejeita nome acima de 60 caracteres', () => {
    const result = categorySchema.safeParse({ ...validCategory(), name: 'x'.repeat(61) });
    expect(firstMessage(result)).toBe('nome da categoria deve ter no máximo 60 caracteres');
  });
});

// ---------- MonthlyPlan ----------

describe('monthlyPlanSchema', () => {
  it('aceita plano com itens embutidos', () => {
    const parsed = monthlyPlanSchema.parse(validMonthlyPlan());
    expect(parsed.monthlyPlanItems).toHaveLength(1);
    expect(parsed.monthlyPlanItems[0]?.status).toBe('PENDING');
  });

  it('aceita plano sem itens (mês vazio é válido)', () => {
    expect(
      monthlyPlanSchema.parse({ ...validMonthlyPlan(), monthlyPlanItems: [] }).monthlyPlanItems,
    ).toEqual([]);
  });

  it('não possui escalares derivados no contrato (removidos do DATABASE §2.4)', () => {
    expect(Object.keys(monthlyPlanSchema.shape)).not.toEqual(
      expect.arrayContaining(['expectedIncome', 'fixedExpenses', 'investmentGoal']),
    );
  });

  it('rejeita item com kind inválido, valor não positivo ou descrição vazia', () => {
    expect(monthlyPlanItemSchema.safeParse({ ...validPlanItem(), kind: 'SAVING' }).success).toBe(
      false,
    );
    expect(monthlyPlanItemSchema.safeParse({ ...validPlanItem(), amountCents: 0 }).success).toBe(
      false,
    );
    expect(
      firstMessage(monthlyPlanItemSchema.safeParse({ ...validPlanItem(), description: ' ' })),
    ).toBe('descrição do item de plano é obrigatória');
  });
});

// ---------- RecurringRule ----------

describe('recurringRuleSchema', () => {
  it('aceita regra válida (endDate null = sem fim)', () => {
    expect(recurringRuleSchema.parse(validRecurringRule()).recurrenceType).toBe('MONTHLY');
  });

  it('só aceita MONTHLY na V1', () => {
    expect(
      recurringRuleSchema.safeParse({ ...validRecurringRule(), recurrenceType: 'WEEKLY' }).success,
    ).toBe(false);
  });

  it('valida janela: endDate não pode ser anterior a startDate', () => {
    const result = recurringRuleSchema.safeParse({
      ...validRecurringRule(),
      startDate: '2026-06-01T03:00:00.000Z',
      endDate: '2026-01-01T03:00:00.000Z',
    });
    expect(firstMessage(result)).toBe('endDate não pode ser anterior a startDate');
  });

  it('rejeita dayOfMonth fora de 1–31', () => {
    expect(recurringRuleSchema.safeParse({ ...validRecurringRule(), dayOfMonth: 0 }).success).toBe(
      false,
    );
    expect(recurringRuleSchema.safeParse({ ...validRecurringRule(), dayOfMonth: 32 }).success).toBe(
      false,
    );
  });
});

// ---------- DraftTransaction ----------

describe('draftTransactionSchema', () => {
  it('aceita draft válido', () => {
    expect(draftTransactionSchema.parse(validDraft()).confidence).toBe(0.92);
  });

  it('rejeita confidence fora de 0–1', () => {
    expect(
      firstMessage(draftTransactionSchema.safeParse({ ...validDraft(), confidence: 1.2 })),
    ).toBe('confidence deve estar entre 0 e 1');
    expect(draftTransactionSchema.safeParse({ ...validDraft(), confidence: -0.1 }).success).toBe(
      false,
    );
  });

  it('exige clientEventId (idempotência) e rawNotification', () => {
    expect(
      firstMessage(draftTransactionSchema.safeParse({ ...validDraft(), clientEventId: '' })),
    ).toBe('clientEventId é obrigatório (idempotência — ADR-006)');
    expect(draftTransactionSchema.safeParse({ ...validDraft(), rawNotification: '' }).success).toBe(
      false,
    );
  });
});

// ---------- Settings ----------

describe('settingsSchema', () => {
  it('aceita settings válidas', () => {
    expect(settingsSchema.parse(validSettings()).theme).toBe('system');
  });

  it('theme é o único enum minúsculo (convenção DATABASE §2.7)', () => {
    expect(settingsSchema.safeParse({ ...validSettings(), theme: 'DARK' }).success).toBe(false);
    expect(settingsSchema.parse({ ...validSettings(), theme: 'dark' }).theme).toBe('dark');
  });

  it('valida moeda ISO 4217 e idioma BCP 47', () => {
    expect(firstMessage(settingsSchema.safeParse({ ...validSettings(), currency: 'reais' }))).toBe(
      'moeda deve ser um código ISO 4217 (ex.: BRL)',
    );
    expect(settingsSchema.safeParse({ ...validSettings(), language: 'português' }).success).toBe(
      false,
    );
  });

  it('valida timezone IANA de verdade (via Intl), não por formato', () => {
    expect(settingsSchema.parse({ ...validSettings(), timezone: 'UTC' }).timezone).toBe('UTC');
    expect(
      firstMessage(settingsSchema.safeParse({ ...validSettings(), timezone: 'America/SaoPaulo' })),
    ).toBe('timezone deve ser um identificador IANA válido');
  });
});

// ---------- User ----------

describe('userSchema / safeUserSchema', () => {
  it('aceita usuário válido e rejeita email inválido', () => {
    expect(userSchema.parse(validUser()).email).toBe('gsalviete@gmail.com');
    expect(firstMessage(userSchema.safeParse({ ...validUser(), email: 'not-an-email' }))).toBe(
      'email inválido',
    );
  });

  it('safeUserSchema NUNCA contém passwordHash (ADR-012) — e é derivado, não duplicado', () => {
    const safe = safeUserSchema.parse(validUser());
    expect('passwordHash' in safe).toBe(false);
    expect(Object.keys(safeUserSchema.shape)).not.toContain('passwordHash');
  });
});

// ---------- BackupMetadata ----------

describe('backupMetadataSchema', () => {
  it('aceita metadados válidos', () => {
    expect(backupMetadataSchema.parse(validBackup()).providerType).toBe('OBJECT_STORAGE');
  });

  it('rejeita providerType desconhecido e tamanho negativo', () => {
    expect(backupMetadataSchema.safeParse({ ...validBackup(), providerType: 'FTP' }).success).toBe(
      false,
    );
    expect(firstMessage(backupMetadataSchema.safeParse({ ...validBackup(), sizeBytes: -1 }))).toBe(
      'sizeBytes não pode ser negativo',
    );
  });
});

// ---------- Consistência transversal ----------

describe('consistência das mensagens de erro (primitivas compartilhadas)', () => {
  it('todo ObjectId inválido produz a MESMA mensagem, em qualquer entidade', () => {
    const expected = 'id deve ser um ObjectId (24 caracteres hexadecimais)';
    expect(firstMessage(categorySchema.safeParse({ ...validCategory(), userId: 'x' }))).toBe(
      expected,
    );
    expect(firstMessage(transactionSchema.safeParse({ ...validTransaction(), userId: 'x' }))).toBe(
      expected,
    );
    expect(
      firstMessage(recurringRuleSchema.safeParse({ ...validRecurringRule(), categoryId: 'x' })),
    ).toBe(expected);
  });

  it('todo amountCents inválido produz a MESMA mensagem, em qualquer entidade', () => {
    const expected = 'amountCents deve ser maior que zero';
    expect(
      firstMessage(transactionSchema.safeParse({ ...validTransaction(), amountCents: -1 })),
    ).toBe(expected);
    expect(
      firstMessage(recurringRuleSchema.safeParse({ ...validRecurringRule(), amountCents: -1 })),
    ).toBe(expected);
    expect(
      firstMessage(monthlyPlanItemSchema.safeParse({ ...validPlanItem(), amountCents: -1 })),
    ).toBe(expected);
  });
});

// ---------- Compatibilidade OpenAPI / IA (Structured Output) ----------

describe('derivação para JSON Schema (base de OpenAPI e Structured Output)', () => {
  it('toda entidade do contrato é conversível para JSON Schema', () => {
    const schemas = [
      transactionSchema,
      categorySchema,
      monthlyPlanSchema,
      recurringRuleSchema,
      draftTransactionSchema,
      settingsSchema,
      userSchema,
      backupMetadataSchema,
    ];
    for (const schema of schemas) {
      const jsonSchema = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' });
      expect(jsonSchema).toHaveProperty('type', 'object');
      expect(jsonSchema).toHaveProperty('properties');
    }
  });

  it('preserva enums e limites numéricos na conversão', () => {
    const jsonSchema = z.toJSONSchema(transactionSchema, {
      unrepresentable: 'any',
      io: 'input',
    }) as {
      properties: Record<string, { enum?: string[]; type?: string }>;
    };
    expect(jsonSchema.properties.type?.enum).toEqual(['INCOME', 'EXPENSE']);
    expect(jsonSchema.properties.status?.enum).toEqual(['FORECAST', 'CONFIRMED', 'CANCELLED']);
    expect(jsonSchema.properties.amountCents?.type).toBe('integer');
  });
});
