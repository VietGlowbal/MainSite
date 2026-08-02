import { describe, expect, it } from 'vitest';
import {
  calendarMonthGrid,
  daysRemaining,
  dueLabel,
  dueTone,
  groupByStatus,
  matchesQuery,
  monthLabel,
  parseIsoDate,
  scheduledByDay,
  shiftMonth,
  toIsoDate,
  unscheduled,
} from './planner';
import type { ProgressStatus, Recommendation } from './recommendation';

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'r1',
    applicationId: 'a1',
    category: 'academics',
    pillar: 'academic',
    title: 'Retake IELTS',
    reason: 'Your band is below the entry requirement.',
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
    confidence: 0.8,
    isDismissed: false,
    sourceAnalysisId: null,
    archivedAt: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupByStatus', () => {
  it('puts every status in its own bucket and leaves the rest empty', () => {
    const groups = groupByStatus([
      rec({ id: 'a', status: 'not_started' }),
      rec({ id: 'b', status: 'in_progress' }),
      rec({ id: 'c', status: 'in_progress' }),
      rec({ id: 'd', status: 'blocked' }),
    ]);
    expect(groups.not_started.map((r) => r.id)).toEqual(['a']);
    expect(groups.in_progress.map((r) => r.id)).toEqual(['b', 'c']);
    expect(groups.blocked.map((r) => r.id)).toEqual(['d']);
    expect(groups.completed).toEqual([]);
    expect(groups.needs_review).toEqual([]);
  });

  it('returns a bucket for every status even with no input', () => {
    const groups = groupByStatus([]);
    const statuses: ProgressStatus[] = [
      'not_started',
      'in_progress',
      'completed',
      'needs_review',
      'blocked',
    ];
    for (const status of statuses) expect(groups[status]).toEqual([]);
  });
});

describe('date helpers', () => {
  it('round-trips an ISO date through UTC', () => {
    expect(toIsoDate(parseIsoDate('2026-08-01'))).toBe('2026-08-01');
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-01-05');
  });

  /* The bug this guards: reading a Postgres DATE with local getters puts a
     student in UTC+7 a day out every evening. */
  it('reads the same calendar day regardless of the local clock time', () => {
    const lateEvening = new Date('2026-08-01T23:30:00Z');
    expect(toIsoDate(lateEvening)).toBe('2026-08-01');
  });
});

describe('daysRemaining', () => {
  const today = new Date('2026-08-01T12:00:00Z');

  it('is null with no deadline', () => {
    expect(daysRemaining(null, today)).toBeNull();
  });

  it('is 0 on the day itself, ignoring the time of day', () => {
    expect(daysRemaining('2026-08-01', today)).toBe(0);
  });

  it('counts forward and backward in whole days', () => {
    expect(daysRemaining('2026-08-08', today)).toBe(7);
    expect(daysRemaining('2026-07-30', today)).toBe(-2);
  });

  it('is null rather than NaN for an unparseable deadline', () => {
    expect(daysRemaining('not-a-date', today)).toBeNull();
  });

  it('crosses a month boundary correctly', () => {
    expect(daysRemaining('2026-09-01', today)).toBe(31);
  });
});

describe('dueTone / dueLabel', () => {
  it('separates overdue, today, soon and later', () => {
    expect(dueTone(-1)).toBe('overdue');
    expect(dueTone(0)).toBe('today');
    expect(dueTone(7)).toBe('soon');
    expect(dueTone(8)).toBe('later');
    expect(dueTone(null)).toBe('none');
  });

  it('reads naturally in each state', () => {
    expect(dueLabel(null)).toBe('Not scheduled');
    expect(dueLabel(-3)).toBe('3d overdue');
    expect(dueLabel(0)).toBe('Due today');
    expect(dueLabel(5)).toBe('5d left');
  });
});

describe('calendarMonthGrid', () => {
  it('is always six whole weeks, so the calendar never changes height', () => {
    for (const month of [0, 1, 4, 11]) {
      const grid = calendarMonthGrid(2026, month);
      expect(grid).toHaveLength(6);
      for (const week of grid) expect(week).toHaveLength(7);
    }
  });

  it('starts each week on a Monday', () => {
    const grid = calendarMonthGrid(2026, 7);
    const firstCell = grid[0]?.[0];
    expect(firstCell).toBeDefined();
    expect(parseIsoDate(firstCell!.iso).getUTCDay()).toBe(1);
  });

  it('marks padding days as outside the month', () => {
    // 1 Aug 2026 is a Saturday, so the grid opens with five July days.
    const grid = calendarMonthGrid(2026, 7);
    const week = grid[0]!;
    expect(week.slice(0, 5).every((d) => !d.inMonth)).toBe(true);
    expect(week[5]?.inMonth).toBe(true);
    expect(week[5]?.iso).toBe('2026-08-01');
  });

  it('covers every day of the month', () => {
    const isos = calendarMonthGrid(2026, 1).flat().map((d) => d.iso);
    expect(isos).toContain('2026-02-01');
    expect(isos).toContain('2026-02-28');
  });
});

describe('scheduledByDay / unscheduled', () => {
  it('splits dated from undated tasks', () => {
    const list = [
      rec({ id: 'a', deadline: '2026-08-10' }),
      rec({ id: 'b', deadline: '2026-08-10' }),
      rec({ id: 'c', deadline: null }),
    ];
    expect(scheduledByDay(list).get('2026-08-10')?.map((r) => r.id)).toEqual(['a', 'b']);
    expect(unscheduled(list).map((r) => r.id)).toEqual(['c']);
  });

  it('has no entry for a day with nothing on it', () => {
    expect(scheduledByDay([rec({ deadline: '2026-08-10' })]).get('2026-08-11')).toBeUndefined();
  });
});

describe('shiftMonth / monthLabel', () => {
  it('rolls the year over in both directions', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('names the month', () => {
    expect(monthLabel(2026, 7)).toBe('August 2026');
  });
});

describe('matchesQuery', () => {
  it('matches an empty query against everything', () => {
    expect(matchesQuery(rec(), '')).toBe(true);
  });

  it('matches title, reason and category', () => {
    expect(matchesQuery(rec(), 'ielts')).toBe(true);
    expect(matchesQuery(rec(), 'entry requirement')).toBe(true);
    expect(matchesQuery(rec(), 'academics')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(matchesQuery(rec(), 'volunteering')).toBe(false);
  });

  /* The UI is bilingual, so a student typing unaccented Vietnamese should
     still find an accented task. */
  it('ignores Vietnamese diacritics in both directions', () => {
    const vietnamese = rec({ title: 'Hồ sơ năng lực' });
    expect(matchesQuery(vietnamese, 'ho so')).toBe(true);
    expect(matchesQuery(vietnamese, 'Hồ sơ')).toBe(true);
  });

  it('handles đ, which does not decompose', () => {
    expect(matchesQuery(rec({ title: 'Đọc thêm' }), 'doc them')).toBe(true);
  });

  it('tolerates a null reason and category', () => {
    expect(matchesQuery(rec({ reason: null, category: null }), 'ielts')).toBe(true);
  });
});
