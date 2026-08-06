import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Recommendation } from '../domain';
import { usePlannerRecommendations } from './use-planner-recommendations';

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'r1',
    applicationId: 'app-1',
    category: 'academics',
    pillar: 'academic',
    title: 'Retake IELTS',
    reason: null,
    priority: 'high',
    status: 'not_started',
    estimatedImpact: 12,
    estimatedEffort: null,
    deadline: null,
    evidenceRequired: false,
    relatedRequirement: null,
    actionLabel: null,
    actionType: null,
    actionTarget: null,
    contentSchema: null,
    contentValue: null,
    submitChecklist: [],
    tips: [],
    suggestedQuestions: [],
    confidence: 0.8,
    isDismissed: false,
    sourceAnalysisId: null,
    archivedAt: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePlannerRecommendations', () => {
  it('moves a status optimistically, then PATCHes it — the board→list sync path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => usePlannerRecommendations('app-1', [rec()]));

    await act(async () => {
      await result.current.updateStatus('r1', 'in_progress');
    });

    expect(result.current.recommendations[0]?.status).toBe('in_progress');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications/app-1/strategy/recommendations/r1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      }),
    );
  });

  it('rolls a status back and reports an error when the save fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(() => usePlannerRecommendations('app-1', [rec()]));

    await act(async () => {
      await result.current.updateStatus('r1', 'in_progress');
    });

    expect(result.current.recommendations[0]?.status).toBe('not_started');
    expect(result.current.error).toBe('That change did not save. Please try again.');
  });

  it('does nothing when the status has not actually changed', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => usePlannerRecommendations('app-1', [rec()]));

    await act(async () => {
      await result.current.updateStatus('r1', 'not_started');
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('schedules a deadline optimistically, then PATCHes it — the calendar/list sync path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => usePlannerRecommendations('app-1', [rec()]));

    await act(async () => {
      await result.current.updateDeadline('r1', '2026-09-01');
    });

    expect(result.current.recommendations[0]?.deadline).toBe('2026-09-01');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/applications/app-1/strategy/recommendations/r1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ deadline: '2026-09-01' }),
      }),
    );
  });

  it('clears a deadline by sending null, and rolls it back on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHook(() =>
      usePlannerRecommendations('app-1', [rec({ deadline: '2026-09-01' })]),
    );

    await act(async () => {
      await result.current.updateDeadline('r1', null);
    });

    expect(result.current.recommendations[0]?.deadline).toBe('2026-09-01');
    expect(result.current.error).toBe('That date did not save. Please try again.');
  });

  it('syncs a status a different control already persisted, without a second PATCH', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => usePlannerRecommendations('app-1', [rec()]));

    act(() => {
      result.current.syncStatus('r1', 'completed');
    });

    await waitFor(() => expect(result.current.recommendations[0]?.status).toBe('completed'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recovers independently when two edits are in flight at once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false }) // status PATCH fails
      .mockResolvedValueOnce({ ok: true }); // deadline PATCH succeeds
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => usePlannerRecommendations('app-1', [rec()]));

    await act(async () => {
      await Promise.all([
        result.current.updateStatus('r1', 'in_progress'),
        result.current.updateDeadline('r1', '2026-09-01'),
      ]);
    });

    expect(result.current.recommendations[0]?.status).toBe('not_started');
    expect(result.current.recommendations[0]?.deadline).toBe('2026-09-01');
  });
});
