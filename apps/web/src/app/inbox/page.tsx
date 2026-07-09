'use client';

/** Inbox da automação (FR-025–030): nada vira transação sem revisão humana. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DraftTransaction } from '@finances/shared';
import { Check, X } from 'lucide-react';
import { Shell } from '../../components/layout/Shell';
import { useCategories } from '../../features/queries';
import { api } from '../../lib/api-client';
import { centsToDecimalInput, formatCents } from '../../lib/format';

export default function InboxPage() {
  const client = useQueryClient();
  const { data: drafts, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => api<DraftTransaction[]>('/inbox'),
  });
  const { data: categories } = useCategories();
  const [categoryByDraft, setCategoryByDraft] = useState<Record<string, string>>({});

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['inbox'] });
    void client.invalidateQueries({ queryKey: ['dashboard'] });
    void client.invalidateQueries({ queryKey: ['transactions'] });
  };

  const confirm = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      api(`/inbox/${id}/confirm`, { method: 'POST', body: { categoryId } }),
    onSuccess: invalidate,
  });
  const ignore = useMutation({
    mutationFn: (id: string) => api(`/inbox/${id}/ignore`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const parsedAmount = (draft: DraftTransaction): number | null => {
    const cents = (draft.parsedData as { amountCents?: unknown }).amountCents;
    return typeof cents === 'number' ? cents : null;
  };

  return (
    <Shell>
      <section className="card" aria-label="Inbox de automação">
        <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Inbox</p>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
          Notificações capturadas pelo Atalho aguardando sua revisão. Nenhuma entra no orçamento sem
          confirmação (Constitution #6).
        </p>
        {isLoading ? (
          <div className="skeleton" style={{ height: 100 }} role="status" />
        ) : (drafts ?? []).length === 0 ? (
          <p className="empty">Inbox vazia — nenhuma notificação pendente.</p>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {(drafts ?? []).map((draft) => {
              const amount = parsedAmount(draft);
              const lowConfidence = draft.confidence < 0.7;
              return (
                <div key={draft.id} className="card" style={{ background: 'var(--surface-2)' }}>
                  <p className="mono" style={{ margin: '0 0 6px', fontSize: 12.5 }}>
                    {draft.rawNotification}
                  </p>
                  <div className="row" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
                    <span className={`badge ${lowConfidence ? 'badge-warning' : 'badge-info'}`}>
                      confiança {Math.round(draft.confidence * 100)}%
                      {lowConfidence ? ' — revisar' : ''}
                    </span>
                    {amount !== null ? (
                      <span className="mono">{formatCents(amount)}</span>
                    ) : (
                      <span className="badge badge-danger">valor não identificado</span>
                    )}
                    <span className="muted">
                      {(draft.parsedData as { description?: string }).description ?? ''}
                    </span>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <select
                      aria-label="Categoria para confirmar"
                      value={categoryByDraft[draft.id] ?? ''}
                      onChange={(e) =>
                        setCategoryByDraft({ ...categoryByDraft, [draft.id]: e.target.value })
                      }
                    >
                      <option value="">Categoria…</option>
                      {(categories ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={amount === null || !categoryByDraft[draft.id] || confirm.isPending}
                      onClick={() =>
                        confirm.mutate({
                          id: draft.id,
                          categoryId: categoryByDraft[draft.id] as string,
                        })
                      }
                    >
                      <Check size={14} aria-hidden /> Confirmar
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={ignore.isPending}
                      onClick={() => ignore.mutate(draft.id)}
                    >
                      <X size={14} aria-hidden /> Ignorar
                    </button>
                  </div>
                  {amount !== null && (
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                      Será registrada como despesa confirmada de{' '}
                      <span className="mono">{centsToDecimalInput(amount)}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </Shell>
  );
}
