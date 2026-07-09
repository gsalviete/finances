'use client';

/** Cards da Home — cada um responde UMA pergunta (Constitution #2/#5). */
import type { DashboardResponse, PacingStatus } from '@finances/shared';
import { formatCents, formatDate } from '../../lib/format';

export const PACING_LABEL: Record<PacingStatus, string> = {
  COMFORTABLE: 'Confortável',
  ON_TRACK: 'Dentro do esperado',
  ATTENTION: 'Atenção',
  CRITICAL: 'Crítico',
};

/** verde=confortável, amarelo=atenção, vermelho=crítico, azul=neutro. */
export const PACING_BADGE: Record<PacingStatus, string> = {
  COMFORTABLE: 'badge-positive',
  ON_TRACK: 'badge-info',
  ATTENTION: 'badge-warning',
  CRITICAL: 'badge-danger',
};

export function HeroCard({ dash }: { dash: DashboardResponse }) {
  const negative = dash.projectedBalanceCents < 0;
  return (
    <section className="card" aria-label="Saldo Projetado">
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Quanto ainda posso gastar este mês
      </p>
      <p
        className="mono"
        style={{
          margin: '4px 0 8px',
          fontSize: 40,
          fontWeight: 750,
          color: negative ? 'var(--danger)' : 'var(--text)',
        }}
      >
        {formatCents(dash.projectedBalanceCents)}
      </p>
      <div className="row" style={{ flexWrap: 'wrap', fontSize: 13.5 }}>
        <span className="muted">
          Gasto diário recomendado:{' '}
          <strong className="mono">{formatCents(dash.dailyBudgetCents)}</strong>
        </span>
        <span className="muted">·</span>
        <span className="muted">
          {dash.monthProgress.remainingDays} dia(s) restante(s) em {dash.month}/{dash.year}
        </span>
      </div>
    </section>
  );
}

export function LensesRow({ dash }: { dash: DashboardResponse }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      <section className="card" aria-label="Saldo Atual">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Saldo Atual (caixa confirmado)
        </p>
        <p className="mono" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 650 }}>
          {formatCents(dash.currentBalanceCents)}
        </p>
      </section>
      <section className="card" aria-label="Planejado">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Planejado (intenção do mês)
        </p>
        <p className="mono" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 650 }}>
          {dash.plannedAvailableCents === null ? '—' : formatCents(dash.plannedAvailableCents)}
        </p>
      </section>
      <section className="card" aria-label="Projeção de encerramento">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Projeção de encerramento*
        </p>
        <p className="mono" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 650 }}>
          {formatCents(dash.projection.endOfMonthCents)}
        </p>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 11.5 }}>
          *estimativa linear, não é certeza
        </p>
      </section>
    </div>
  );
}

export function PacingCard({ dash }: { dash: DashboardResponse }) {
  const { pacing } = dash;
  return (
    <section className="card" aria-label="Ritmo financeiro">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Ritmo do gasto variável</p>
        <span className={`badge ${PACING_BADGE[pacing.status]}`}>
          {PACING_LABEL[pacing.status]}
        </span>
      </div>
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
        Você gastou <strong className="mono">{formatCents(pacing.actualCents)}</strong> de um ritmo
        esperado de <strong className="mono">{formatCents(pacing.expectedCents)}</strong> até hoje
        {pacing.ratio !== null ? ` (${Math.round(pacing.ratio * 100)}%)` : ''}. Estimativa linear.
      </p>
    </section>
  );
}

export function RecentTransactions({ dash }: { dash: DashboardResponse }) {
  return (
    <section className="card" aria-label="Últimas movimentações">
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Últimas movimentações</p>
      {dash.recentTransactions.length === 0 ? (
        <p className="empty">Nenhuma movimentação ainda — registre a primeira em Transações.</p>
      ) : (
        <table className="table">
          <tbody>
            {dash.recentTransactions.map((t) => (
              <tr key={t.id}>
                <td>{formatDate(t.date)}</td>
                <td>{t.description || <span className="muted">sem descrição</span>}</td>
                <td>
                  <span
                    className={`badge ${t.status === 'CONFIRMED' ? 'badge-positive' : t.status === 'FORECAST' ? 'badge-info' : 'badge-neutral'}`}
                  >
                    {t.status === 'CONFIRMED'
                      ? 'Confirmada'
                      : t.status === 'FORECAST'
                        ? 'Prevista'
                        : 'Cancelada'}
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function TopCategories({ dash }: { dash: DashboardResponse }) {
  return (
    <section className="card" aria-label="Categorias mais utilizadas">
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Maiores categorias do mês</p>
      {dash.topCategories.length === 0 ? (
        <p className="empty">Sem gastos confirmados neste mês.</p>
      ) : (
        <div className="grid" style={{ gap: 8 }}>
          {dash.topCategories.slice(0, 5).map((c) => (
            <div key={c.categoryId}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{c.name}</span>
                <span className="mono">
                  {formatCents(c.totalCents)} · {Math.round(c.percentage)}%
                </span>
              </div>
              <div
                style={{ background: 'var(--surface-2)', borderRadius: 999, height: 6 }}
                role="presentation"
              >
                <div
                  style={{
                    width: `${Math.max(2, Math.round(c.percentage))}%`,
                    background: 'var(--accent)',
                    height: 6,
                    borderRadius: 999,
                    transition: 'width var(--motion)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
