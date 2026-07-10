'use client';

/** Planejamento (FR-008) + assistente de início de mês (jornada §4). */
import { useState } from 'react';
import { monthYearOf, systemClock, type MonthlyPlanItemInput } from '@finances/shared';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Shell } from '../../components/layout/Shell';
import { MotionCard, Stagger } from '../../components/motion';
import { useCategories, usePlan, usePlanMutations, useRules } from '../../features/queries';
import { ApiError } from '../../lib/api-client';
import { centsToDecimalInput, formatCents, parseDecimalToCents } from '../../lib/format';

const KIND_LABEL: Record<string, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  INVESTMENT: 'Investimento',
};

interface EditableItem extends MonthlyPlanItemInput {
  status?: string;
  amountText: string;
}

export default function PlanningPage() {
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
      setFeedback('Plano atualizado — indicadores recalculados na próxima leitura.');
    } catch (error) {
      setFeedback(error instanceof ApiError ? error.message : 'Valores inválidos (use 12,34)');
    }
  };

  return (
    <Shell>
      <Stagger className="grid">
        {isLoading && <div className="skeleton" style={{ height: 160 }} role="status" />}

        {isError && (
          <MotionCard interactive={false} aria-label="Assistente de início de mês">
            <p style={{ margin: 0, fontWeight: 600 }}>
              Iniciar {current.month}/{current.year}
            </p>
            <p className="muted" style={{ fontSize: 13.5 }}>
              O assistente congela suas recorrências no plano do mês e cria as movimentações
              esperadas — a Home responde certo desde o dia 1º.
            </p>
            <div className="grid" style={{ gap: 6, margin: '8px 0' }}>
              {(rules ?? [])
                .filter((rule) => rule.active)
                .map((rule) => (
                  <div key={rule.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <span>
                      <span className="badge badge-neutral">
                        {rule.investment ? 'Investimento' : KIND_LABEL[rule.type]}
                      </span>{' '}
                      {rule.description} <span className="muted">(dia {rule.dayOfMonth})</span>
                    </span>
                    <span className="mono">{formatCents(rule.amountCents)}</span>
                  </div>
                ))}
              {(rules ?? []).length === 0 && (
                <p className="empty">
                  Nenhuma recorrência cadastrada — o plano nascerá vazio e você adiciona itens
                  manualmente.
                </p>
              )}
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
              Confirmar e iniciar o mês
            </button>
          </MotionCard>
        )}

        {plan && (
          <MotionCard interactive={false} aria-label="Plano do mês">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                Plano de {plan.month}/{plan.year}
                {plan.archived && <span className="badge badge-neutral"> arquivado</span>}
              </p>
              <span className="row">
                <button type="button" className="btn" onClick={addItem}>
                  <Plus size={14} aria-hidden /> Item
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={save}
                  disabled={draft === null || update.isPending}
                >
                  <Save size={14} aria-hidden /> Salvar
                </button>
              </span>
            </div>

            {items.length === 0 ? (
              <p className="empty">Plano sem itens — adicione compromissos previsíveis.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Valor (R$)</th>
                    <th>Status</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const paid = item.status === 'PAID';
                    return (
                      <tr key={item.id ?? `new-${index}`}>
                        <td>
                          <select
                            aria-label="Tipo do item"
                            value={item.kind}
                            disabled={paid}
                            onChange={(e) =>
                              setItem(index, { kind: e.target.value as EditableItem['kind'] })
                            }
                          >
                            {Object.entries(KIND_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            aria-label="Descrição do item"
                            value={item.description}
                            disabled={paid}
                            onChange={(e) => setItem(index, { description: e.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            aria-label="Categoria do item"
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
                            aria-label="Valor do item"
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
                            {paid ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        <td>
                          {!paid && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              aria-label="Remover item"
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
