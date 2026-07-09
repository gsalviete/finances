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
import { useDashboard } from '../features/queries';

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  return (
    <Shell>
      {isLoading && (
        <div className="grid" role="status" aria-label="Carregando painel">
          <div className="skeleton" style={{ height: 130 }} />
          <div className="skeleton" style={{ height: 90 }} />
          <div className="skeleton" style={{ height: 200 }} />
        </div>
      )}
      {isError && (
        <div className="empty">
          Não foi possível carregar o painel.{' '}
          <button type="button" className="btn" onClick={() => refetch()}>
            Tentar de novo
          </button>
        </div>
      )}
      {data && (
        <div className="grid">
          <HeroCard dash={data} />
          <LensesRow dash={data} />
          <PacingCard dash={data} />
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
          >
            <RecentTransactions dash={data} />
            <TopCategories dash={data} />
          </div>
        </div>
      )}
    </Shell>
  );
}
