import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseApplication } from '@/lib/apply-types';

const mocks = vi.hoisted(() => ({ prefetch: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ prefetch: mocks.prefetch, refresh: vi.fn() }),
}));

import { MyApplicationSection } from '@/app/apply/my-application-section';

describe('MyApplicationSection workspace prefetch', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('prefetches an application workspace only after hover or keyboard focus', () => {
    render(
      <MyApplicationSection
        applications={[
          {
            id: 'app-1',
            universityName: 'Example University',
            courseName: 'Computer Science',
            userId: 'user-1',
            status: 'researching',
            progressPercentage: 20,
            parseStatus: 'complete',
            importStatus: 'complete',
            createdAt: '2026-08-01T00:00:00Z',
            updatedAt: '2026-08-01T00:00:00Z',
          } as CourseApplication,
        ]}
        logoByUniversityId={{}}
        strategyReadyById={{}}
      />,
    );

    expect(mocks.prefetch).not.toHaveBeenCalled();
    const link = screen.getByRole('link', { name: /continue applying/i });
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);

    expect(mocks.prefetch).toHaveBeenCalledTimes(2);
    expect(mocks.prefetch).toHaveBeenLastCalledWith('/apply/app-1');
  });

  it('uses the parser status heartbeat instead of application updated_at for stale UI', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parseStatus: 'processing', isStale: false, error: null }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ parseStatus: 'processing', isStale: true, error: null }),
      });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MyApplicationSection
        applications={[
          {
            id: 'app-stale-ui',
            universityName: 'Example University',
            courseName: '',
            courseUrl: 'https://example.edu/course',
            userId: 'user-1',
            status: 'researching',
            progressPercentage: 20,
            parseStatus: 'processing',
            importStatus: 'complete',
            // Deliberately old application projection; the server heartbeat is fresh.
            updatedAt: '2020-01-01T00:00:00Z',
            createdAt: '2020-01-01T00:00:00Z',
          } as CourseApplication,
        ]}
        logoByUniversityId={{}}
        strategyReadyById={{}}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications/app-stale-ui/parse-status',
      { cache: 'no-store' },
    );
    expect(screen.queryByText(/taking longer than usual/i)).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
