/**
 * Tipos do contrato — TODOS inferidos dos schemas (ADR-014).
 * Este módulo apenas reexporta por conveniência; nenhuma interface é declarada aqui.
 */
export type {
  Transaction,
  Category,
  MonthlyPlan,
  MonthlyPlanItem,
  RecurringRule,
  DraftTransaction,
  Settings,
  User,
  SafeUser,
  BackupMetadata,
  RegisterInput,
  LoginInput,
  AuthSession,
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesQuery,
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateInstallmentPurchaseInput,
  ListTransactionsQuery,
  TransactionListPage,
  CreateRecurringRuleInput,
  UpdateRecurringRuleInput,
} from '../schemas';
export type {
  TransactionType,
  TransactionStatus,
  TransactionOrigin,
  PlanItemKind,
  PlanItemStatus,
  RecurrenceType,
  DraftStatus,
  BackupProviderType,
  BackupFrequency,
  MotionLevel,
  Theme,
} from '../enums';
