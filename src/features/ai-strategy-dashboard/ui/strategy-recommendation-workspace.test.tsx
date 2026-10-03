import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StrategyRecommendationWorkspace } from './strategy-recommendation-workspace';

const hooks = vi.hoisted(() => ({ router: { replace: vi.fn() }, language: { t: (value: string) => value } }));
vi.mock('next/navigation', () => ({ useRouter: () => hooks.router }));
vi.mock('@/lib/i18n', () => ({ useLanguage: () => hooks.language }));
vi.mock('@/shared/ui', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
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

  it('uses the selected Personal Report version for Strategy loading', async () => {
    const versionId = '11111111-1111-4111-8111-111111111111';
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      expect(url).toBe(
        `/api/applications/app-1/strategy/recommendation?personalReportVersionId=${versionId}`,
      );
      expect(init).toBeUndefined();
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ reportV3: { marker: 'selected' } }) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<StrategyRecommendationWorkspace applicationId="app-1" personalReportVersionId={versionId} />);

    await waitFor(() => expect(screen.getByText('selected')).toBeInTheDocument());
  });

  it('runs a new request when Try again is clicked after generation fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'temporary failure' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reportV3: { marker: 'recovered' } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<StrategyRecommendationWorkspace applicationId="app-1" />);
    fireEvent.click(await screen.findByText('Try again'));
    expect(await screen.findByText('recovered')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('loads the new version when the Personal Report selection changes', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve({ ok: true, json: async () => ({ reportV3: { marker: url.includes('version-2') ? 'second' : 'first' } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<StrategyRecommendationWorkspace applicationId="app-1" personalReportVersionId="version-1" />);
    expect(await screen.findByText('first')).toBeInTheDocument();
    rerender(<StrategyRecommendationWorkspace applicationId="app-1" personalReportVersionId="version-2" />);
    expect(await screen.findByText('second')).toBeInTheDocument();
    expect(screen.queryByText('first')).not.toBeInTheDocument();
  });

  it('ignores the previous version response while the new version is loading', async () => {
    let resolvePrevious!: (response: Response) => void;
    const previous = new Promise<Response>((resolve) => { resolvePrevious = resolve; });
    const fetchMock = vi.fn((url: string) => url.includes('version-1') ? previous : Promise.resolve({ ok: true, json: async () => ({ reportV3: { marker: 'current-version' } }) } as Response));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<StrategyRecommendationWorkspace applicationId="app-1" personalReportVersionId="version-1" />);
    rerender(<StrategyRecommendationWorkspace applicationId="app-1" personalReportVersionId="version-2" />);
    expect(await screen.findByText('current-version')).toBeInTheDocument();
    await act(async () => resolvePrevious({ ok: true, json: async () => ({}) } as Response));
    expect(screen.getByText('current-version')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
