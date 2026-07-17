'use client';

/** Cards da Home — cada um responde UMA pergunta (Constitution #2/#5). */
import type { DashboardResponse, PacingStatus } from '@finances/shared';
import { useI18n } from '../../lib/i18n';
import {
  AnimatedBar,
  CountUp,
  MotionCard,
  ProgressRing,
  Stagger,
  StaggerItem,
  motion,
} from '../motion';

/** verde=confortável, amarelo=atenção, vermelho=crítico, marca=neutro. */
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
  const { t, fmtCents } = useI18n();
  const negative = dash.projectedBalanceCents < 0;
  const { daysInMonth, elapsedDays, remainingDays } = dash.monthProgress;
  return (
    <MotionCard className="card-hero" interactive={false} aria-label={t('hero.aria')}>
      <div
        className="row"
        style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-5)' }}
      >
        <div style={{ minWidth: 220 }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            {t('hero.question')}
          </p>
          <CountUp
            value={dash.projectedBalanceCents}
            format={fmtCents}
            className="mono"
            style={{
              display: 'block',
              margin: '6px 0 10px',
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: negative ? 'var(--danger)' : 'var(--text)',
            }}
          />
          <div className="row" style={{ flexWrap: 'wrap', fontSize: 13.5 }}>
            <span className="muted">
              {t('hero.dailyBudget')}:{' '}
              <strong className="mono">{fmtCents(dash.dailyBudgetCents)}</strong>
            </span>
            <span className="muted">·</span>
            <span className="muted">
              {t('hero.daysRemaining', { n: remainingDays, m: dash.month, y: dash.year })}
            </span>
          </div>
        </div>
        <ProgressRing
          progress={daysInMonth > 0 ? elapsedDays / daysInMonth : 0}
          color={PACING_COLOR[dash.pacing.status]}
          label={t('hero.ringAria')}
          value={`${remainingDays}d`}
          caption={t('hero.ringCaption')}
        />
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
  const { t, fmtCents } = useI18n();
  const value: React.CSSProperties = {
    display: 'block',
    margin: '4px 0 0',
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.01em',
  };
  return (
    <Stagger
      className="grid"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
    >
      <Lens label={t('lens.current')}>
        <CountUp
          value={dash.currentBalanceCents}
          format={fmtCents}
          className="mono"
          style={value}
        />
      </Lens>
      <Lens label={t('lens.planned')}>
        {dash.plannedAvailableCents === null ? (
          <p className="mono" style={value}>
            —
          </p>
        ) : (
          <CountUp
            value={dash.plannedAvailableCents}
            format={fmtCents}
            className="mono"
            style={value}
          />
        )}
      </Lens>
      <Lens label={t('lens.projection')}>
        <CountUp
          value={dash.projection.endOfMonthCents}
          format={fmtCents}
          className="mono"
          style={value}
        />
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 11.5 }}>
          {t('lens.projectionNote')}
        </p>
      </Lens>
    </Stagger>
  );
}

export function PacingCard({ dash }: { dash: DashboardResponse }) {
  const { t, fmtCents } = useI18n();
  const { pacing } = dash;
  const pct = pacing.ratio !== null ? Math.round(pacing.ratio * 100) : 0;
  return (
    <MotionCard aria-label={t('pacing.aria')}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p className="card-title" style={{ margin: 0 }}>
          {t('pacing.title')}
        </p>
        <span className={`badge ${PACING_BADGE[pacing.status]}`}>
          {t(`pacing.${pacing.status}`)}
        </span>
      </div>
      <div style={{ margin: '12px 0 4px' }}>
        <AnimatedBar percent={pct} color={PACING_COLOR[pacing.status]} delay={0.15} />
      </div>
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
        {t('pacing.text', {
          actual: fmtCents(pacing.actualCents),
          expected: fmtCents(pacing.expectedCents),
          pct: pacing.ratio !== null ? ` (${pct}%)` : '',
        })}
      </p>
    </MotionCard>
  );
}

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

export function RecentTransactions({ dash }: { dash: DashboardResponse }) {
  const { t, fmtCents, fmtDate } = useI18n();
  return (
    <MotionCard aria-label={t('recent.aria')}>
      <p className="card-title">{t('recent.title')}</p>
      {dash.recentTransactions.length === 0 ? (
        <p className="empty">{t('recent.empty')}</p>
      ) : (
        <table className="table">
          <motion.tbody
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
          >
            {dash.recentTransactions.map((tx) => (
              <motion.tr key={tx.id} variants={rowVariants}>
                <td>{fmtDate(tx.date)}</td>
                <td>{tx.description || <span className="muted">{t('tx.noDescription')}</span>}</td>
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
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      )}
    </MotionCard>
  );
}

export function TopCategories({ dash }: { dash: DashboardResponse }) {
  const { t, fmtCents } = useI18n();
  return (
    <MotionCard aria-label={t('top.aria')}>
      <p className="card-title">{t('top.title')}</p>
      {dash.topCategories.length === 0 ? (
        <p className="empty">{t('top.empty')}</p>
      ) : (
        <Stagger className="grid" style={{ gap: 10 }}>
          {dash.topCategories.slice(0, 5).map((c, i) => (
            <StaggerItem key={c.categoryId}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{c.name}</span>
                <span className="mono">
                  {fmtCents(c.totalCents)} · {Math.round(c.percentage)}%
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
