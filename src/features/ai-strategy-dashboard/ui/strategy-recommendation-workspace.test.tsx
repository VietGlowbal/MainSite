import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrategyRecommendationWorkspace } from './strategy-recommendation-workspace';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/i18n', () => ({ useLanguage: () => ({ t: (value: string) => value }) }));
vi.mock('@/shared/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  usePrefersReducedMotion: () => true,
}));
vi.mock('./strategy-report-v3-view', () => ({
  StrategyReportV3View: ({ report }: { report: { marker: string } }) => <div>{report.marker}</div>,
}));
vi.mock('./strategy-report-v2-view', () => ({ StrategyReportV2View: () => <div>legacy-v2</div> }));
vi.mock('./strategy-recommendation-report', () => ({ StrategyRecommendationReport: () => <div>legacy-f7</div> }));

afterEach(() => vi.unstubAllGlobals());

describe('StrategyRecommendationWorkspace', () => {
  it('does not render a stale GET V3 row before POST verifies the current cache/lineage', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (!init) return Promise.resolve({ ok: true, json: () => Promise.resolve({ reportV3: { marker: 'stale' } }) } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ reportV3: { marker: 'current' } }) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StrategyRecommendationWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('current')).toBeInTheDocument());
    expect(screen.queryByText('stale')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/applications/app-1/strategy/recommendation', { method: 'POST' });
  });

  it('retries a failed Strategy V3 generation before showing a legacy fallback', async () => {
    let postCalls = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (!init) return Promise.resolve({ ok: true, json: () => Promise.resolve({ reportV2: { legacy: true } }) } as Response);
      if (init.method !== 'POST') throw new Error(`unexpected fetch ${url}`);
      postCalls += 1;
      return postCalls === 1
        ? Promise.resolve({ ok: false, status: 502, json: () => Promise.resolve({ error: 'temporary failure' }) } as Response)
        : Promise.resolve({ ok: true, json: () => Promise.resolve({ reportV3: { marker: 'retried' } }) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StrategyRecommendationWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('retried')).toBeInTheDocument());
    expect(postCalls).toBe(2);
    expect(screen.queryByText('legacy-v2')).not.toBeInTheDocument();
  });
});
