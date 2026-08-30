import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisWorkspace } from './analysis-workspace';

const PERSONAL_POST = '/api/applications/app-1/personal-report';
const PERSONAL_GET = '/api/applications/app-1/personal-report';
const MATCHING_GET = '/api/applications/app-1/strategy/course-match';
const MATCHING_POST = '/api/applications/app-1/match-insights';
const STRATEGY_GET = '/api/applications/app-1/strategy/recommendation';
const STRATEGY_POST = '/api/applications/app-1/strategy/recommendation';
const FRIENDLY_REPORT_ERROR = "We couldn't finish this report. We'll retry it using your confirmed information.";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnalysisWorkspace', () => {
  it('reuses all existing reports after reload without starting generation', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_GET && !init) return jsonResponse({ reportV2: { coreIdentity: {} }, stale: false });
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('Your reports are ready')).toBeInTheDocument());
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET'])).toEqual([
      [PERSONAL_GET, 'GET'],
      [MATCHING_GET, 'GET'],
      [STRATEGY_GET, 'GET'],
    ]);
  });

  it('does not start Matching Report generation until Personal Report completes', async () => {
    let resolvePersonal: (() => void) | undefined;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolvePersonal = () => resolve({ ok: true, json: () => Promise.resolve({ reportV2: { coreIdentity: {} } }) } as Response);
        });
      }
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId={'app-1'} />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(PERSONAL_POST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(MATCHING_GET);

    resolvePersonal?.();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(MATCHING_GET));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(MATCHING_POST, { method: 'POST' }));
  });

  it('generates the canonical Personal Report and Matching Report without calling legacy endpoints', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') return jsonResponse({ reportV2: { coreIdentity: {} } });
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    expect(screen.getByText('Your information is confirmed')).toBeInTheDocument();
    expect(screen.getAllByText('Generating…')).toHaveLength(2);

    await waitFor(() => expect(screen.getByText('Your reports are ready')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'View my reports' })).toHaveAttribute(
      'href',
      '/ai-strategy/personal-report?return=%2Fai-strategy%2Fapp-1%2Fstrategy%2Fanalysis',
    );
    expect(screen.getByRole('link', { name: 'Open Matching Report' })).toHaveAttribute(
      'href',
      '/ai-strategy/app-1/matching-report',
    );
    expect(fetchMock).toHaveBeenCalledWith(PERSONAL_POST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(screen.queryByText('Generating…')).not.toBeInTheDocument();
  });

  it('starts Strategy Report generation only after Personal and Matching Reports complete', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') return jsonResponse({ reportV2: { coreIdentity: {} } });
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: null });
      if (url === STRATEGY_POST && init?.method === 'POST') return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('Your reports are ready')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(STRATEGY_POST, { method: 'POST' });
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls.indexOf(STRATEGY_GET)).toBeGreaterThan(urls.indexOf(MATCHING_POST));
    expect(urls.indexOf(STRATEGY_POST)).toBeGreaterThan(urls.indexOf(MATCHING_POST));
    expect(screen.getAllByRole('link', { name: 'Open my Strategy Report' })[0]).toHaveAttribute(
      'href',
      '/ai-strategy/app-1/strategy-report',
    );
  });

  it('does not retry Strategy Report automatically after a failed attempt', async () => {
    let strategyAttempt = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') return jsonResponse({ reportV2: { coreIdentity: {} } });
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: null });
      if (url === STRATEGY_POST && init?.method === 'POST') {
        strategyAttempt += 1;
        return strategyAttempt === 1
          ? jsonResponse({ error: 'Temporary failure' }, false, 502)
          : jsonResponse({ reportV3: { id: 's1' } });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText(FRIENDLY_REPORT_ERROR)).toBeInTheDocument());
    expect(strategyAttempt).toBe(1);
  });

  it('does not let a legacy Strategy row suppress V3 generation', async () => {
    let strategyPostCalls = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') return jsonResponse({ reportV2: { coreIdentity: {} } });
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: null, reportV2: { legacy: true } });
      if (url === STRATEGY_POST && init?.method === 'POST') {
        strategyPostCalls += 1;
        return jsonResponse({ reportV3: { id: 's1' } });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('Your reports are ready')).toBeInTheDocument());
    expect(strategyPostCalls).toBe(1);
  });

  it('waits for queued Personal Report generation before starting Matching Report generation', async () => {
    let initialRead = true;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') {
        return jsonResponse({ queued: true }, true, 202);
      }
      if (url === PERSONAL_POST && !init) {
        if (initialRead) {
          initialRead = false;
          return jsonResponse({ generation: { status: 'pending' }, reportV2: null });
        }
        return jsonResponse({ generation: { status: 'complete' }, reportV2: { coreIdentity: {} } });
      }
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('Your reports are ready')).toBeInTheDocument());
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      PERSONAL_POST,
      PERSONAL_POST,
      PERSONAL_POST,
      MATCHING_GET,
      MATCHING_POST,
      STRATEGY_GET,
    ]);
  });

  it('does not requeue a failed Personal Report from the polling client', async () => {
    let initialRead = true;
    let personalPoll = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') {
        return jsonResponse({ queued: true }, true, 202);
      }
      if (url === PERSONAL_POST && !init) {
        if (initialRead) {
          initialRead = false;
          return jsonResponse({ generation: { status: 'pending' }, reportV2: null });
        }
        personalPoll += 1;
        return personalPoll === 1
          ? jsonResponse({ generation: { status: 'retry' }, reportV2: null })
          : jsonResponse({ generation: { status: 'complete' }, reportV2: { coreIdentity: {} } });
      }
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('Your reports are ready')).toBeInTheDocument(), { timeout: 5_000 });
    const personalPosts = fetchMock.mock.calls.filter(([url, init]) => url === PERSONAL_POST && init?.method === 'POST');
    expect(personalPosts).toHaveLength(1);
    expect(personalPosts.some(([, init]) => String(init?.body).includes('"force":true'))).toBe(false);
  });

  it('uses a current Personal Report even when an old queue row is still active', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') {
        return jsonResponse({ queued: true }, true, 202);
      }
      if (url === PERSONAL_POST && !init) {
        return jsonResponse({
          reportV2: { coreIdentity: {} },
          stale: false,
          generation: { status: 'pending' },
        });
      }
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') return jsonResponse({ analysis: { id: 'm1' } });
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText('Your reports are ready')).toBeInTheDocument());
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      PERSONAL_GET,
      MATCHING_GET,
      MATCHING_POST,
      STRATEGY_GET,
    ]);
  });

  it('lets the canonical Personal Report be opened while Matching is still generating', async () => {
    let resolveMatching: (() => void) | null = null;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') return jsonResponse({ reportV2: { coreIdentity: {} } });
      if (url === MATCHING_GET && !init) {
        return new Promise<Response>((resolve) => {
          resolveMatching = () => resolve({ ok: true, json: () => Promise.resolve({ analysis: null }) } as Response);
        });
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Open report' })).toHaveAttribute(
        'href',
        '/ai-strategy/personal-report?return=%2Fai-strategy%2Fapp-1%2Fstrategy%2Fanalysis',
      ),
    );
    expect(screen.getAllByText('Generating…')).toHaveLength(1);
    expect(resolveMatching).not.toBeNull();
  });

  it('shows an inline Matching error with its own retry, independent of Personal Report', async () => {
    let matchingAttempt = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') return jsonResponse({ reportV2: { coreIdentity: {} } });
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') {
        matchingAttempt += 1;
        return matchingAttempt <= 1
          ? jsonResponse({ error: 'AI service not configured' }, false, 502)
          : jsonResponse({ analysis: { id: 'm1' } });
      }
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() =>
      expect(screen.getByText(FRIENDLY_REPORT_ERROR)).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: 'Open report' })).toHaveAttribute(
      'href',
      '/ai-strategy/personal-report?return=%2Fai-strategy%2Fapp-1%2Fstrategy%2Fanalysis',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Open report' })).toHaveLength(2));
  });

  it('does not retry Matching Report automatically after a failed generation', async () => {
    let matchingAttempt = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') return jsonResponse({ reportV2: { coreIdentity: {} } });
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') {
        matchingAttempt += 1;
        return matchingAttempt === 1
          ? jsonResponse({ error: 'Temporary failure' }, false, 502)
          : jsonResponse({ analysis: { id: 'm1' } });
      }
      if (url === STRATEGY_GET && !init) return jsonResponse({ reportV3: { id: 's1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() => expect(screen.getByText(FRIENDLY_REPORT_ERROR)).toBeInTheDocument());
    expect(matchingAttempt).toBe(1);
  });

  it('fails Personal Report visibly if the canonical report generation fails', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') return jsonResponse({ error: 'Personal report failed' }, false);
      if (url === MATCHING_GET && !init) return new Promise<Response>(() => {});
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);
    await waitFor(() => expect(screen.getAllByText(FRIENDLY_REPORT_ERROR)).toHaveLength(2));
    expect(screen.queryByText('Personal report failed')).not.toBeInTheDocument();
  });

  it('renders the confirmed date and a course-specific matching subtitle', () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AnalysisWorkspace
        applicationId="app-1"
        confirmedAt="2026-08-13T10:24:00.000Z"
        matchingSubtitle="University of Cambridge — Engineering"
      />,
    );

    expect(screen.getByText(/Confirmed/)).toBeInTheDocument();
    expect(screen.getByText('University of Cambridge — Engineering')).toBeInTheDocument();
  });

  it('handles downstream 429 rate limit errors with retryable state without erasing portal links', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: 'Rate limited' }),
        } as Response);
      }
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: { id: 'm1' } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() =>
      expect(
        screen.getByText("We're still working on your reports"),
      ).toBeInTheDocument(),
    );

    // Portal link remains accessible
    expect(screen.getByRole('link', { name: 'Go to My Portal' })).toHaveAttribute(
      'href',
      '/apply',
    );
  });

  it('handles downstream 503 service unavailable errors gracefully', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === PERSONAL_POST && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: 'Service unavailable' }),
        } as Response);
      }
      if (url === MATCHING_GET && !init) return jsonResponse({ analysis: null });
      if (url === MATCHING_POST && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: 'Service unavailable' }),
        } as Response);
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnalysisWorkspace applicationId="app-1" />);

    await waitFor(() =>
      expect(
        screen.getByText("We're still working on your reports"),
      ).toBeInTheDocument(),
    );

    // Retry buttons exist
    const retryButtons = screen.getAllByRole('button', { name: 'Try again' });
    expect(retryButtons.length).toBeGreaterThan(0);
  });
});
