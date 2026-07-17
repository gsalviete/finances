'use client';

/** Home (FR-001): responde em <15s — Saldo Projetado dominante no topo. */
import { Shell } from '../components/layout/Shell';
import {
  HeroCard,
  LensesRow,
  PacingCard,
  RecentTransactions,
  TopCategories,
} from '../components/dashboard/cards';
import { Stagger } from '../components/motion';
import { useDashboard } from '../features/queries';
import { useI18n } from '../lib/i18n';

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const { t } = useI18n();

  return (
    <Shell>
      {isLoading && (
        <div className="grid" role="status" aria-label={t('home.loadingAria')}>
          <div className="skeleton" style={{ height: 130 }} />
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      )}
      {isError && (
        <div className="empty">
          {t('home.loadError')}{' '}
          <button type="button" className="btn" onClick={() => refetch()}>
            {t('common.retry')}
          </button>
        </div>
      )}
      {data && (
        <Stagger className="grid">
          <HeroCard dash={data} />
          <LensesRow dash={data} />
          <PacingCard dash={data} />
          <Stagger
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
          >
            <RecentTransactions dash={data} />
            <TopCategories dash={data} />
          </Stagger>
        </Stagger>
      )}
    </Shell>
  );
}
