'use client';

/** Hooks TanStack Query por domínio — estado remoto NUNCA vive em Context/Redux. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Category,
  CreateCategoryInput,
  CreateInstallmentPurchaseInput,
  CreateRecurringRuleInput,
  CreateTransactionInput,
  DashboardResponse,
  MonthlyPlan,
  RecurringRule,
  Settings,
  Transaction,
  UpdateCategoryInput,
  UpdateMonthlyPlanInput,
  UpdateSettingsInput,
  UpdateTransactionInput,
  UpdateWishlistItemInput,
  CreateWishlistItemInput,
  WishlistItem,
} from '@finances/shared';
import { api } from '../lib/api-client';

const invalidateFinancials = (client: ReturnType<typeof useQueryClient>) => {
  void client.invalidateQueries({ queryKey: ['dashboard'] });
  void client.invalidateQueries({ queryKey: ['transactions'] });
  void client.invalidateQueries({ queryKey: ['planning'] });
};

// ---------- dashboard ----------
export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardResponse>('/dashboard') });

// ---------- categorias ----------
export const useCategories = (includeArchived = false) =>
  useQuery({
    queryKey: ['categories', includeArchived],
    queryFn: () =>
      api<Category[]>(`/categories?includeArchived=${includeArchived}&includeExpired=true`),
  });

export function useCategoryMutations() {
  const client = useQueryClient();
  const invalidate = () => void client.invalidateQueries({ queryKey: ['categories'] });
  return {
    create: useMutation({
      mutationFn: (input: CreateCategoryInput) =>
        api<Category>('/categories', { method: 'POST', body: input }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
        api<Category>(`/categories/${id}`, { method: 'PATCH', body: input }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/categories/${id}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
  };
}

// ---------- transações ----------
export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
}

export const useTransactionsPage = (cursor: string | null, filters: string) =>
  useQuery({
    queryKey: ['transactions', filters, cursor],
    queryFn: () =>
      api<TransactionPage>(`/transactions?limit=20${filters}${cursor ? `&cursor=${cursor}` : ''}`),
  });

export function useTransactionMutations() {
  const client = useQueryClient();
  const invalidate = () => invalidateFinancials(client);
  return {
    create: useMutation({
      mutationFn: (input: CreateTransactionInput) =>
        api<Transaction>('/transactions', { method: 'POST', body: input }),
      onSuccess: invalidate,
    }),
    createInstallments: useMutation({
      mutationFn: (input: CreateInstallmentPurchaseInput) =>
        api<Transaction[]>('/transactions/installments', { method: 'POST', body: input }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateTransactionInput }) =>
        api<Transaction>(`/transactions/${id}`, { method: 'PATCH', body: input }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/transactions/${id}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
  };
}

// ---------- planejamento ----------
export const usePlan = () =>
  useQuery({
    queryKey: ['planning'],
    queryFn: () => api<MonthlyPlan>('/planning'),
    retry: false,
  });

export function usePlanMutations() {
  const client = useQueryClient();
  const invalidate = () => invalidateFinancials(client);
  return {
    ensure: useMutation({
      mutationFn: (input: { year: number; month: number }) =>
        api<MonthlyPlan>('/planning', { method: 'POST', body: input }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: UpdateMonthlyPlanInput) =>
        api<MonthlyPlan>('/planning', { method: 'PUT', body: input }),
      onSuccess: invalidate,
    }),
  };
}

// ---------- recorrências ----------
export const useRules = () =>
  useQuery({ queryKey: ['rules'], queryFn: () => api<RecurringRule[]>('/recurring-rules') });

export function useRuleMutations() {
  const client = useQueryClient();
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['rules'] });
  };
  return {
    create: useMutation({
      mutationFn: (input: CreateRecurringRuleInput) =>
        api<RecurringRule>('/recurring-rules', { method: 'POST', body: input }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/recurring-rules/${id}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
  };
}

// ---------- settings ----------
export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings') });

export function useSettingsMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) =>
      api<Settings>('/settings', { method: 'PUT', body: input }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['settings'] }),
  });
}

// ---------- wishlist (ADR-018 — isolada do núcleo financeiro) ----------
export const useWishlist = () =>
  useQuery({ queryKey: ['wishlist'], queryFn: () => api<WishlistItem[]>('/wishlist') });

export function useWishlistMutations() {
  const client = useQueryClient();
  const invalidate = () => void client.invalidateQueries({ queryKey: ['wishlist'] });
  return {
    create: useMutation({
      mutationFn: (input: CreateWishlistItemInput) =>
        api<WishlistItem>('/wishlist', { method: 'POST', body: input }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateWishlistItemInput }) =>
        api<WishlistItem>(`/wishlist/${id}`, { method: 'PATCH', body: input }),
      onSuccess: invalidate,
    }),
    refresh: useMutation({
      mutationFn: (id: string) => api<WishlistItem>(`/wishlist/${id}/refresh`, { method: 'POST' }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<void>(`/wishlist/${id}`, { method: 'DELETE' }),
      onSuccess: invalidate,
    }),
  };
}
