'use client';

/** Planejamento (FR-008) + assistente de início de mês (jornada §4). */
import { useState } from 'react';
import { monthYearOf, systemClock, type MonthlyPlanItemInput } from '@finances/shared';
import { Plus, Save, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Shell } from '../../components/layout/Shell';
import { MotionCard, Stagger } from '../../components/motion';
import { useCategories, usePlan, usePlanMutations, useRules } from '../../features/queries';
import { ApiError } from '../../lib/api-client';
import { centsToDecimalInput, parseDecimalToCents } from '../../lib/format';
import { useI18n } from '../../lib/i18n';

const KINDS = ['INCOME', 'EXPENSE', 'INVESTMENT'] as const;

interface EditableItem extends MonthlyPlanItemInput {
  status?: string;
  amountText: string;
}

export default function PlanningPage() {
  const { t, fmtCents, currency } = useI18n();
  const { data: plan, isLoading, isError, refetch } = usePlan();
  const { data: rules } = useRules();
  const { data: categories } = useCategories();
  const { ensure, update } = usePlanMutations();
  const [draft, setDraft] = useState<EditableItem[] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const current = monthYearOf(systemClock.now());

  const items: EditableItem[] =
    draft ??
    (plan?.monthlyPlanItems ?? []).map((item) => ({
      id: item.id,
      kind: item.kind,
      description: item.description,
      amountCents: item.amountCents,
      categoryId: item.categoryId,
      status: item.status,
      amountText: centsToDecimalInput(item.amountCents),
    }));

  const setItem = (index: number, patch: Partial<EditableItem>) => {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    setDraft(next);
  };

  const addItem = () => {
    const firstCategory = categories?.[0]?.id ?? '';
    setDraft([
      ...items,
      {
        kind: 'EXPENSE',
        description: '',
        amountCents: 0,
        categoryId: firstCategory,
        amountText: '',
      },
    ]);
  };

  const removeItem = (index: number) => setDraft(items.filter((_, i) => i !== index));

  const save = async () => {
    if (!plan) return;
    setFeedback(null);
    try {
      await update.mutateAsync({
        year: plan.year,
        month: plan.month,
        monthlyPlanItems: items.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          kind: item.kind,
          description: item.description,
          amountCents: parseDecimalToCents(item.amountText),
          categoryId: item.categoryId,
        })),
      });
      setDraft(null);
      setFeedback(t('plan.saved'));
    } catch (error) {
      setFeedback(
        error instanceof ApiError
          ? error.message
          : t('plan.invalid', { example: t('tx.amountPlaceholder') }),
      );
    }
  };

  return (
    <Shell>
      <PageHeader
        eyebrow={t('plan.eyebrow')}
        title={t('plan.pageTitle')}
        subtitle={t('plan.pageSubtitle')}
      />
      <Stagger className="grid">
        {isLoading && <div className="skeleton" style={{ height: 160 }} role="status" />}

        {isError && (
          <MotionCard interactive={false} aria-label={t('plan.assistantAria')}>
            <p className="card-title" style={{ marginBottom: 0 }}>
              {t('plan.startTitle', { m: current.month, y: current.year })}
            </p>
            <p className="muted" style={{ fontSize: 13.5 }}>
              {t('plan.startText')}
            </p>
            <div className="grid" style={{ gap: 6, margin: '8px 0' }}>
              {(rules ?? [])
                .filter((rule) => rule.active)
                .map((rule) => (
                  <div key={rule.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      <span className="badge badge-neutral">
                        {rule.investment ? t('plan.investment') : t(`kind.${rule.type}`)}
                      </span>{' '}
                      {rule.description}{' '}
                      <span className="muted">{t('plan.day', { n: rule.dayOfMonth })}</span>
                    </span>
                    <span className="mono">{fmtCents(rule.amountCents)}</span>
                  </div>
                ))}
              {(rules ?? []).length === 0 && <p className="empty">{t('plan.emptyRules')}</p>}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={ensure.isPending}
              onClick={async () => {
                await ensure.mutateAsync(current);
                await refetch();
              }}
            >
              {t('plan.confirmStart')}
            </button>
          </MotionCard>
        )}

        {plan && (
          <MotionCard interactive={false} aria-label={t('plan.planAria')}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <p className="card-title" style={{ margin: 0 }}>
                {t('plan.title', { m: plan.month, y: plan.year })}
                {plan.archived && (
                  <span className="badge badge-neutral"> {t('plan.archived')}</span>
                )}
              </p>
              <span className="row">
                <button type="button" className="btn" onClick={addItem}>
                  <Plus size={14} aria-hidden /> {t('plan.addItem')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={save}
                  disabled={draft === null || update.isPending}
                >
                  <Save size={14} aria-hidden /> {t('plan.save')}
                </button>
              </span>
            </div>

            {items.length === 0 ? (
              <p className="empty">{t('plan.empty')}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('plan.thKind')}</th>
                    <th>{t('plan.thDescription')}</th>
                    <th>{t('plan.thCategory')}</th>
                    <th>{t('plan.thAmount', { currency })}</th>
                    <th>{t('plan.thStatus')}</th>
                    <th aria-label={t('plan.actionsAria')} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const paid = item.status === 'PAID';
                    return (
                      <tr key={item.id ?? `new-${index}`}>
                        <td>
                          <select
                            aria-label={t('plan.kindAria')}
                            value={item.kind}
                            disabled={paid}
                            onChange={(e) =>
                              setItem(index, { kind: e.target.value as EditableItem['kind'] })
                            }
                          >
                            {KINDS.map((value) => (
                              <option key={value} value={value}>
                                {t(`kind.${value}`)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            aria-label={t('plan.descAria')}
                            value={item.description}
                            disabled={paid}
                            onChange={(e) => setItem(index, { description: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            aria-label={t('plan.categoryAria')}
                            value={item.categoryId}
                            disabled={paid}
                            onChange={(e) => setItem(index, { categoryId: e.target.value })}
                          >
                            {(categories ?? []).map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            aria-label={t('plan.amountAria')}
                            className="mono"
                            style={{ width: 110 }}
                            inputMode="decimal"
                            value={item.amountText}
                            disabled={paid}
                            onChange={(e) => setItem(index, { amountText: e.target.value })}
                          />
                        </td>
                        <td>
                          <span className={`badge ${paid ? 'badge-positive' : 'badge-info'}`}>
                            {paid ? t('plan.paid') : t('plan.pending')}
                          </span>
                        </td>
                        <td>
                          {!paid && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              aria-label={t('plan.remove')}
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {feedback && (
              <p className="muted" role="status" style={{ margin: '10px 0 0', fontSize: 13 }}>
                {feedback}
              </p>
            )}
          </MotionCard>
        )}
      </Stagger>
    </Shell>
  );
}
