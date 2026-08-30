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
  it('renders an existing V3 report without POSTing again on reload', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init) throw new Error(`unexpected generation request ${url}`);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ reportV3: { marker: 'current' } }) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StrategyRecommendationWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('current')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the legacy fallback after one failed Strategy V3 generation', async () => {
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

    await waitFor(() => expect(screen.getByText('legacy-v2')).toBeInTheDocument());
    expect(postCalls).toBe(1);
    expect(screen.queryByText('retried')).not.toBeInTheDocument();
  });
});
