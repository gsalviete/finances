/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DashboardResponse } from '@finances/shared';
import { HeroCard, PACING_BADGE, PacingCard } from '../src/components/dashboard/cards';

const dash: DashboardResponse = {
  year: 2026,
  month: 7,
  projectedBalanceCents: 120000,
  currentBalanceCents: 470000,
  plannedAvailableCents: 150000,
  dailyBudgetCents: 5454,
  pacing: { expectedCents: 48387, actualCents: 30000, ratio: 0.62, status: 'COMFORTABLE' },
  projection: {
    endOfMonthCents: 54000,
    dailyVariableAverageCents: 3000,
    remainingCommitmentsCents: -350000,
  },
  monthProgress: { daysInMonth: 31, elapsedDays: 10, remainingDays: 22 },
  recentTransactions: [],
  topCategories: [],
};

describe('Home — cards das lentes', () => {
  it('HeroCard exibe o Saldo Projetado dominante e o gasto diário', () => {
    render(<HeroCard dash={dash} />);
    expect(screen.getByText(/1\.200,00/)).toBeInTheDocument();
    expect(screen.getByText(/54,54/)).toBeInTheDocument();
    expect(screen.getByText(/22 dia\(s\) restante/)).toBeInTheDocument();
  });

  it('PacingCard usa cor semântica por status (verde=confortável...)', () => {
    render(<PacingCard dash={dash} />);
    expect(screen.getByText('Confortável')).toHaveClass('badge-positive');
    expect(PACING_BADGE.CRITICAL).toBe('badge-danger');
    expect(PACING_BADGE.ATTENTION).toBe('badge-warning');
  });
});
