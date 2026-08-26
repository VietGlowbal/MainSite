import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardSummary } from './dashboard-summary';

describe('DashboardSummary source isolation', () => {
  it('uses canonical progress instead of legacy recommendation progress', () => {
    render(<DashboardSummary
      universityName="Test university"
      courseName="Test course"
      imageUrl={null}
      location={null}
      currentMatchPercent={80}
      deadline={null}
      recommendations={[{ id: 'legacy', title: 'Legacy task', status: 'not_started' } as never]}
      canonicalProgress={{ completed: 2, total: 2, percentage: 100, nextTitle: null }}
    />);
    expect(screen.getByText('100% complete · 2 of 2 tasks completed')).toBeInTheDocument();
    expect(screen.getByText('All caught up')).toBeInTheDocument();
    expect(screen.queryByText('Legacy task')).not.toBeInTheDocument();
  });

  it('keeps legacy summary behavior when canonical progress is not supplied', () => {
    render(<DashboardSummary
      universityName="Test university"
      courseName="Test course"
      imageUrl={null}
      location={null}
      currentMatchPercent={80}
      deadline={null}
      recommendations={[{ id: 'legacy', title: 'Legacy task', status: 'not_started' } as never]}
    />);
    expect(screen.getByText('Legacy task')).toBeInTheDocument();
  });
});
