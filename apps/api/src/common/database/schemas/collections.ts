/**
 * Coleções físicas do MongoDB (DATABASE §2) — nomes exatos do contrato.
 * Os nomes de model do Mongoose ficam junto, para injeção via @InjectModel.
 */
export const COLLECTIONS = {
  users: 'users',
  categories: 'categories',
  transactions: 'transactions',
  monthlyPlans: 'monthlyPlans',
  recurringRules: 'recurringRules',
  draftTransactions: 'draftTransactions',
  settings: 'settings',
  backups: 'backups',
  wishlistItems: 'wishlistItems',
} as const;

export const MODELS = {
  User: 'User',
  Category: 'Category',
  Transaction: 'Transaction',
  MonthlyPlan: 'MonthlyPlan',
  RecurringRule: 'RecurringRule',
  DraftTransaction: 'DraftTransaction',
  Settings: 'Settings',
  Backup: 'Backup',
  WishlistItem: 'WishlistItem',
} as const;
