'use client';

/** Cards da Home — cada um responde UMA pergunta (Constitution #2/#5). */
import type { DashboardResponse, PacingStatus } from '@finances/shared';
import { formatCents, formatDate } from '../../lib/format';
import { AnimatedBar, CountUp, MotionCard, Stagger, StaggerItem, motion } from '../motion';

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

const PACING_COLOR: Record<PacingStatus, string> = {
  COMFORTABLE: 'var(--positive)',
  ON_TRACK: 'var(--info)',
  ATTENTION: 'var(--warning)',
  CRITICAL: 'var(--danger)',
};

export function HeroCard({ dash }: { dash: DashboardResponse }) {
  const negative = dash.projectedBalanceCents < 0;
  return (
    <MotionCard className="card-hero" interactive={false} aria-label="Saldo Projetado">
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Quanto ainda posso gastar este mês
      </p>
      <CountUp
        value={dash.projectedBalanceCents}
        format={formatCents}
        className="mono"
        style={{
          display: 'block',
          margin: '4px 0 8px',
          fontSize: 44,
          fontWeight: 750,
          letterSpacing: '-0.02em',
          color: negative ? 'var(--danger)' : 'var(--text)',
        }}
      />
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
    </MotionCard>
  );
}

function Lens({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <MotionCard aria-label={label}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {label}
      </p>
      {children}
    </MotionCard>
  );
}

export function LensesRow({ dash }: { dash: DashboardResponse }) {
  const value: React.CSSProperties = {
    display: 'block',
    margin: '4px 0 0',
    fontSize: 22,
    fontWeight: 650,
    letterSpacing: '-0.01em',
  };
  return (
    <Stagger
      className="grid"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
    >
      <Lens label="Saldo Atual (caixa confirmado)">
        <CountUp
          value={dash.currentBalanceCents}
          format={formatCents}
          className="mono"
          style={value}
        />
      </Lens>
      <Lens label="Planejado (intenção do mês)">
        {dash.plannedAvailableCents === null ? (
          <p className="mono" style={value}>
            —
          </p>
        ) : (
          <CountUp
            value={dash.plannedAvailableCents}
            format={formatCents}
            className="mono"
            style={value}
          />
        )}
      </Lens>
      <Lens label="Projeção de encerramento*">
        <CountUp
          value={dash.projection.endOfMonthCents}
          format={formatCents}
          className="mono"
          style={value}
        />
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 11.5 }}>
          *estimativa linear, não é certeza
        </p>
      </Lens>
    </Stagger>
  );
}

export function PacingCard({ dash }: { dash: DashboardResponse }) {
  const { pacing } = dash;
  const pct = pacing.ratio !== null ? Math.round(pacing.ratio * 100) : 0;
  return (
    <MotionCard aria-label="Ritmo financeiro">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Ritmo do gasto variável</p>
        <span className={`badge ${PACING_BADGE[pacing.status]}`}>
          {PACING_LABEL[pacing.status]}
        </span>
      </div>
      <div style={{ margin: '12px 0 4px' }}>
        <AnimatedBar percent={pct} color={PACING_COLOR[pacing.status]} delay={0.15} />
      </div>
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
        Você gastou <strong className="mono">{formatCents(pacing.actualCents)}</strong> de um ritmo
        esperado de <strong className="mono">{formatCents(pacing.expectedCents)}</strong> até hoje
        {pacing.ratio !== null ? ` (${pct}%)` : ''}. Estimativa linear.
      </p>
    </MotionCard>
  );
}

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export function RecentTransactions({ dash }: { dash: DashboardResponse }) {
  return (
    <MotionCard aria-label="Últimas movimentações">
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Últimas movimentações</p>
      {dash.recentTransactions.length === 0 ? (
        <p className="empty">Nenhuma movimentação ainda — registre a primeira em Transações.</p>
      ) : (
        <table className="table">
          <motion.tbody
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
          >
            {dash.recentTransactions.map((t) => (
              <motion.tr key={t.id} variants={rowVariants}>
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
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      )}
    </MotionCard>
  );
}

export function TopCategories({ dash }: { dash: DashboardResponse }) {
  return (
    <MotionCard aria-label="Categorias mais utilizadas">
      <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Maiores categorias do mês</p>
      {dash.topCategories.length === 0 ? (
        <p className="empty">Sem gastos confirmados neste mês.</p>
      ) : (
        <Stagger className="grid" style={{ gap: 10 }}>
          {dash.topCategories.slice(0, 5).map((c, i) => (
            <StaggerItem key={c.categoryId}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{c.name}</span>
                <span className="mono">
                  {formatCents(c.totalCents)} · {Math.round(c.percentage)}%
                </span>
              </div>
              <div style={{ marginTop: 4 }}>
                <AnimatedBar percent={c.percentage} height={6} delay={0.1 + i * 0.05} />
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </MotionCard>
  );
}
