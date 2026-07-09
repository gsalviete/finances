'use client';

/** Transações (FR-014/016/019): registrar um gasto leva <10s. */
import { useMemo, useState } from 'react';
import { systemClock, type Transaction } from '@finances/shared';
import { Check, Plus, Trash2, XCircle } from 'lucide-react';
import { Shell } from '../../components/layout/Shell';
import {
  useCategories,
  useTransactionMutations,
  useTransactionsPage,
} from '../../features/queries';
import { ApiError } from '../../lib/api-client';
import {
  dateInputToIso,
  formatCents,
  formatDate,
  parseDecimalToCents,
  toDateInputValue,
} from '../../lib/format';

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmada',
  FORECAST: 'Prevista',
  CANCELLED: 'Cancelada',
};

export default function TransactionsPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<Transaction[][]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const filters = statusFilter ? `&status=${statusFilter}` : '';
  const { data, isLoading } = useTransactionsPage(cursor, filters);
  const { data: categories } = useCategories();
  const mutations = useTransactionMutations();

  // formulário
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => toDateInputValue(systemClock.now()));
  const [categoryId, setCategoryId] = useState('');
  const [forecast, setForecast] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const allItems = useMemo(() => {
    const seen = new Set<string>();
    const merged: Transaction[] = [];
    for (const page of [...pages, data?.items ?? []]) {
      for (const item of page) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      }
    }
    return merged;
  }, [pages, data]);

  const resetList = () => {
    setPages([]);
    setCursor(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    try {
      const amountCents = parseDecimalToCents(amount);
      if (installments > 1) {
        await mutations.createInstallments.mutateAsync({
          totalAmountCents: amountCents,
          installmentTotal: installments,
          description,
          date: new Date(dateInputToIso(date)),
          categoryId,
        });
        setFeedback(`Compra registrada em ${installments}x com soma exata.`);
      } else {
        await mutations.create.mutateAsync({
          type,
          status: forecast ? 'FORECAST' : 'CONFIRMED',
          amountCents,
          description,
          date: new Date(dateInputToIso(date)),
          categoryId,
        });
        setFeedback('Movimentação registrada.');
      }
      setAmount('');
      setDescription('');
      resetList();
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : 'Valor inválido (use 12,34)');
    }
  };

  const patchStatus = async (id: string, status: 'CONFIRMED' | 'CANCELLED') => {
    await mutations.update.mutateAsync({ id, input: { status } });
    resetList();
  };

  const remove = async (transaction: Transaction) => {
    // FR-019: exclusão sempre com confirmação
    if (!window.confirm(`Excluir "${transaction.description || 'movimentação'}"?`)) return;
    await mutations.remove.mutateAsync(transaction.id);
    resetList();
  };

  return (
    <Shell>
      <div className="grid">
        <section className="card" aria-label="Nova movimentação">
          <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Registrar movimentação</p>
          <form
            onSubmit={submit}
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}
          >
            <div className="field">
              <label htmlFor="tx-type">Tipo</label>
              <select
                id="tx-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'EXPENSE' | 'INCOME')}
                disabled={installments > 1}
              >
                <option value="EXPENSE">Despesa</option>
                <option value="INCOME">Receita</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tx-amount">Valor (R$)</label>
              <input
                id="tx-amount"
                inputMode="decimal"
                placeholder="123,45"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tx-date">Data</label>
              <input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tx-category">Categoria</label>
              <select
                id="tx-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tx-desc">Descrição</label>
              <input
                id="tx-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex.: mercado"
              />
            </div>
            <div className="field">
              <label htmlFor="tx-installments">Parcelas</label>
              <select
                id="tx-installments"
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'À vista' : `${n}x`}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ justifyContent: 'end' }}>
              <label className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={forecast}
                  onChange={(e) => setForecast(e.target.checked)}
                  disabled={installments > 1}
                />
                Prevista (ainda não ocorreu)
              </label>
            </div>
            <div className="field" style={{ justifyContent: 'end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={mutations.create.isPending || mutations.createInstallments.isPending}
              >
                <Plus size={15} aria-hidden /> Registrar
              </button>
            </div>
          </form>
          {feedback && (
            <p className="muted" role="status" style={{ margin: '10px 0 0', fontSize: 13 }}>
              {feedback}
            </p>
          )}
        </section>

        <section className="card" aria-label="Lista de transações">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Movimentações</p>
            <select
              aria-label="Filtrar por status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                resetList();
              }}
            >
              <option value="">Todas</option>
              <option value="CONFIRMED">Confirmadas</option>
              <option value="FORECAST">Previstas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </div>
          {isLoading && allItems.length === 0 ? (
            <div className="skeleton" style={{ height: 120 }} role="status" />
          ) : allItems.length === 0 ? (
            <p className="empty">Nenhuma movimentação encontrada.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {allItems.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.date)}</td>
                    <td>
                      {t.description || <span className="muted">—</span>}
                      {t.installmentNumber !== null && (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {' '}
                          ({t.installmentNumber}/{t.installmentTotal})
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${t.status === 'CONFIRMED' ? 'badge-positive' : t.status === 'FORECAST' ? 'badge-info' : 'badge-neutral'}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td
                      className="mono"
                      style={{
                        textAlign: 'right',
                        color: t.type === 'INCOME' ? 'var(--positive)' : 'var(--text)',
                      }}
                    >
                      {t.type === 'INCOME' ? '+' : '−'}
                      {formatCents(t.amountCents)}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {t.status === 'FORECAST' && (
                        <button
                          type="button"
                          className="btn"
                          title="Confirmar"
                          aria-label="Confirmar"
                          onClick={() => patchStatus(t.id, 'CONFIRMED')}
                        >
                          <Check size={14} aria-hidden />
                        </button>
                      )}{' '}
                      {t.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          className="btn"
                          title="Cancelar"
                          aria-label="Cancelar"
                          onClick={() => patchStatus(t.id, 'CANCELLED')}
                        >
                          <XCircle size={14} aria-hidden />
                        </button>
                      )}{' '}
                      <button
                        type="button"
                        className="btn btn-danger"
                        title="Excluir"
                        aria-label="Excluir"
                        onClick={() => remove(t)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data?.nextCursor && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPages((prev) => [...prev, data.items]);
                  setCursor(data.nextCursor);
                }}
              >
                Carregar mais
              </button>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
