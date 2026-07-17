'use client';

/** Transações (FR-014/016/019): registrar um gasto leva <10s. */
import { useMemo, useState } from 'react';
import { systemClock, type Transaction } from '@finances/shared';
import { Check, Plus, Trash2, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Shell } from '../../components/layout/Shell';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { AnimatePresence, MotionCard, Stagger, motion } from '../../components/motion';
import {
  useCategories,
  useTransactionMutations,
  useTransactionsPage,
} from '../../features/queries';
import { ApiError } from '../../lib/api-client';
import { dateInputToIso, parseDecimalToCents } from '../../lib/format';
import { useI18n } from '../../lib/i18n';

export default function TransactionsPage() {
  const { t, fmtCents, fmtDate, dateInputValue, currency } = useI18n();
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
  const [date, setDate] = useState(() => dateInputValue(systemClock.now()));
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
        setFeedback(t('tx.createdInstallments', { n: installments }));
      } else {
        await mutations.create.mutateAsync({
          type,
          status: forecast ? 'FORECAST' : 'CONFIRMED',
          amountCents,
          description,
          date: new Date(dateInputToIso(date)),
          categoryId,
        });
        setFeedback(t('tx.created'));
      }
      setAmount('');
      setDescription('');
      resetList();
    } catch (error) {
      setFeedback(
        error instanceof ApiError
          ? error.message
          : t('tx.invalidAmount', { example: t('tx.amountPlaceholder') }),
      );
    }
  };

  const patchStatus = async (id: string, status: 'CONFIRMED' | 'CANCELLED') => {
    await mutations.update.mutateAsync({ id, input: { status } });
    resetList();
  };

  const remove = async (transaction: Transaction) => {
    // FR-019: exclusão sempre com confirmação
    const name = transaction.description || t('tx.fallbackName');
    if (!window.confirm(t('tx.deleteConfirm', { name }))) return;
    await mutations.remove.mutateAsync(transaction.id);
    resetList();
  };

  return (
    <Shell>
      <PageHeader
        eyebrow={t('tx.eyebrow')}
        title={t('tx.pageTitle')}
        subtitle={t('tx.pageSubtitle')}
      />
      <Stagger className="grid">
        <MotionCard interactive={false} aria-label={t('tx.newAria')}>
          <p className="card-title">{t('tx.formTitle')}</p>
          <form
            onSubmit={submit}
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}
          >
            <div className="field">
              <label htmlFor="tx-type">{t('tx.type')}</label>
              <select
                id="tx-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'EXPENSE' | 'INCOME')}
                disabled={installments > 1}
              >
                <option value="EXPENSE">{t('tx.expense')}</option>
                <option value="INCOME">{t('tx.income')}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tx-amount">{t('tx.amount', { currency })}</label>
              <input
                id="tx-amount"
                inputMode="decimal"
                placeholder={t('tx.amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tx-date">{t('tx.date')}</label>
              <input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="tx-category">{t('tx.category')}</label>
              <select
                id="tx-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">{t('tx.select')}</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tx-desc">{t('tx.description')}</label>
              <input
                id="tx-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('tx.descPlaceholder')}
              />
            </div>
            <div className="field">
              <label htmlFor="tx-installments">{t('tx.installments')}</label>
              <select
                id="tx-installments"
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? t('tx.cash') : `${n}x`}
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
                {t('tx.forecast')}
              </label>
            </div>
            <div className="field" style={{ justifyContent: 'end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={mutations.create.isPending || mutations.createInstallments.isPending}
              >
                <Plus size={15} aria-hidden /> {t('tx.register')}
              </button>
            </div>
          </form>
          {feedback && (
            <p className="muted" role="status" style={{ margin: '10px 0 0', fontSize: 13 }}>
              {feedback}
            </p>
          )}
        </MotionCard>

        <MotionCard interactive={false} aria-label={t('tx.listAria')}>
          <div
            className="row"
            style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 8 }}
          >
            <p className="card-title" style={{ margin: 0 }}>
              {t('tx.listTitle')}
            </p>
            <SegmentedControl
              ariaLabel={t('tx.filterAria')}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                resetList();
              }}
              options={[
                { value: '', label: t('tx.filterAll') },
                { value: 'CONFIRMED', label: t('tx.filterConfirmed') },
                { value: 'FORECAST', label: t('tx.filterForecast') },
                { value: 'CANCELLED', label: t('tx.filterCancelled') },
              ]}
            />
          </div>
          {isLoading && allItems.length === 0 ? (
            <div className="skeleton" style={{ height: 120 }} role="status" />
          ) : allItems.length === 0 ? (
            <p className="empty">{t('tx.empty')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('tx.thDate')}</th>
                  <th>{t('tx.thDescription')}</th>
                  <th>{t('tx.thStatus')}</th>
                  <th style={{ textAlign: 'right' }}>{t('tx.thAmount')}</th>
                  <th aria-label={t('tx.thActions')} />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {allItems.map((tx) => (
                    <motion.tr
                      key={tx.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <td>{fmtDate(tx.date)}</td>
                      <td>
                        {tx.description || <span className="muted">—</span>}
                        {tx.installmentNumber !== null && (
                          <span className="muted" style={{ fontSize: 12 }}>
                            {' '}
                            ({tx.installmentNumber}/{tx.installmentTotal})
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${tx.status === 'CONFIRMED' ? 'badge-positive' : tx.status === 'FORECAST' ? 'badge-info' : 'badge-neutral'}`}
                        >
                          {t(`status.${tx.status}`)}
                        </span>
                      </td>
                      <td
                        className="mono"
                        style={{
                          textAlign: 'right',
                          color: tx.type === 'INCOME' ? 'var(--positive)' : 'var(--text)',
                        }}
                      >
                        {tx.type === 'INCOME' ? '+' : '−'}
                        {fmtCents(tx.amountCents)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {tx.status === 'FORECAST' && (
                          <button
                            type="button"
                            className="btn"
                            title={t('tx.confirm')}
                            aria-label={t('tx.confirm')}
                            onClick={() => patchStatus(tx.id, 'CONFIRMED')}
                          >
                            <Check size={14} aria-hidden />
                          </button>
                        )}{' '}
                        {tx.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            className="btn"
                            title={t('tx.cancel')}
                            aria-label={t('tx.cancel')}
                            onClick={() => patchStatus(tx.id, 'CANCELLED')}
                          >
                            <XCircle size={14} aria-hidden />
                          </button>
                        )}{' '}
                        <button
                          type="button"
                          className="btn btn-danger"
                          title={t('tx.delete')}
                          aria-label={t('tx.delete')}
                          onClick={() => remove(tx)}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
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
                {t('tx.loadMore')}
              </button>
            </div>
          )}
        </MotionCard>
      </Stagger>
    </Shell>
  );
}
