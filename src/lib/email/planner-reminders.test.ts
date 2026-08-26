import { describe, expect, it } from 'vitest';
import {
  deadlineLocalDate,
  deadlineReminderEventKey,
  decideDeadlineReminder,
  decideWeeklyDigest,
  sameDayBatchEventKey,
  weeklyDigestEventKey,
} from './planner-reminders';

/**
 * Every instant below is a fixed UTC literal and every zone a real IANA name,
 * so the suite never depends on the machine clock or locale. The local-day
 * assertions are the point: several cases are chosen so naive UTC-day math
 * would produce a DIFFERENT slot than the user's wall calendar.
 */

const ICT = 'Asia/Ho_Chi_Minh';

function deadlineInput(overrides: Partial<Parameters<typeof decideDeadlineReminder>[0]> = {}) {
  return {
    applicationId: 'app-1',
    deadline: '2026-10-15',
    authority: 'official' as const,
    timeZone: ICT,
    now: new Date('2026-09-15T02:00:00Z'),
    ...overrides,
  };
}

describe('decideDeadlineReminder', () => {
  it('fires the 30-day reminder at exactly 30 whole local days out', () => {
    // 02:00Z = 09:00 ICT on Sep 15; Oct 15 minus Sep 15 = 30 days.
    expect(decideDeadlineReminder(deadlineInput())).toEqual({
      kind: 'deadline',
      slot: '30d',
      applicationId: 'app-1',
    });
  });

  it('fires the 7-day and 1-day reminders at exactly 7 and 1 whole local days out', () => {
    expect(
      decideDeadlineReminder(deadlineInput({ now: new Date('2026-10-08T02:00:00Z') })),
    ).toMatchObject({ kind: 'deadline', slot: '7d' });
    expect(
      decideDeadlineReminder(deadlineInput({ now: new Date('2026-10-14T02:00:00Z') })),
    ).toMatchObject({ kind: 'deadline', slot: '1d' });
  });

  it('batches same-day deadlines instead of firing a per-task slot', () => {
    expect(decideDeadlineReminder(deadlineInput({ now: new Date('2026-10-15T02:00:00Z') }))).toEqual(
      { kind: 'same_day_batch', applicationId: 'app-1' },
    );
  });

  it('never reminds for a past deadline', () => {
    const decision = decideDeadlineReminder(
      deadlineInput({ now: new Date('2026-10-16T02:00:00Z') }),
    );
    expect(decision).toEqual({ kind: 'none', reason: 'deadline_past' });
  });

  it('rejects an unparseable or impossible deadline instead of guessing', () => {
    expect(decideDeadlineReminder(deadlineInput({ deadline: 'not-a-date' }))).toEqual({
      kind: 'none',
      reason: 'invalid_deadline',
    });
    // Feb 30 must fail, not roll over into March.
    expect(decideDeadlineReminder(deadlineInput({ deadline: '2026-02-30' }))).toEqual({
      kind: 'none',
      reason: 'invalid_deadline',
    });
  });

  it('never reminds off an unattributable (unknown-authority) date', () => {
    expect(decideDeadlineReminder(deadlineInput({ authority: 'unknown' }))).toEqual({
      kind: 'none',
      reason: 'authority_unknown',
    });
  });

  it('treats official, user_set and derived authorities as equally eligible', () => {
    for (const authority of ['official', 'user_set', 'derived'] as const) {
      expect(decideDeadlineReminder(deadlineInput({ authority }))).toMatchObject({
        kind: 'deadline',
        slot: '30d',
      });
    }
  });

  it('reads the local day, not the UTC day, across the Asia/Ho_Chi_Minh midnight boundary', () => {
    // 17:30Z is already Sep 2, 00:30 locally. UTC-day math would call the Sep 3
    // deadline two days out (no slot); the student's calendar says one.
    expect(
      decideDeadlineReminder(deadlineInput({ now: new Date('2026-09-01T17:30:00Z'), deadline: '2026-09-03' })),
    ).toMatchObject({ kind: 'deadline', slot: '1d' });
    // Same instant against a Sep 2 deadline is same-day locally, though UTC
    // still counts one day out.
    expect(
      decideDeadlineReminder(deadlineInput({ now: new Date('2026-09-01T17:30:00Z'), deadline: '2026-09-02' })),
    ).toEqual({ kind: 'same_day_batch', applicationId: 'app-1' });
  });

  it('keeps whole-day distances stable across DST transitions', () => {
    // Australia/Lord_Howe shifts only 30 minutes at each transition (+10:30 →
    // +11:00 on Oct 4, 2026), so any hour-based arithmetic inside this window
    // would drift; the window Sep 16 → Oct 16 crosses it.
    expect(
      decideDeadlineReminder(
        deadlineInput({
          timeZone: 'Australia/Lord_Howe',
          now: new Date('2026-09-16T00:30:00Z'),
          deadline: '2026-10-16',
        }),
      ),
    ).toMatchObject({ kind: 'deadline', slot: '30d' });

    // Europe/Berlin loses an hour on Oct 25, 2026 (CEST → CET); the window
    // Sep 26 → Oct 26 crosses that switch and must still read exactly 30 days.
    expect(
      decideDeadlineReminder(
        deadlineInput({
          timeZone: 'Europe/Berlin',
          now: new Date('2026-09-26T12:00:00Z'),
          deadline: '2026-10-26',
        }),
      ),
    ).toMatchObject({ kind: 'deadline', slot: '30d' });
  });

  it('returns none outside every reminder window', () => {
    // 45 days out: before the earliest window.
    expect(
      decideDeadlineReminder(deadlineInput({ now: new Date('2026-08-31T02:00:00Z') })),
    ).toEqual({ kind: 'none', reason: 'outside_reminder_windows' });
    // 2 days out: the gap between the 1-day slot and the same-day batch.
    expect(
      decideDeadlineReminder(deadlineInput({ now: new Date('2026-10-13T02:00:00Z') })),
    ).toEqual({ kind: 'none', reason: 'outside_reminder_windows' });
  });

  it('ignores an invalid timezone or run instant instead of throwing mid-batch', () => {
    expect(decideDeadlineReminder(deadlineInput({ timeZone: 'Not/A_Zone' }))).toEqual({
      kind: 'none',
      reason: 'invalid_time_zone',
    });
    expect(decideDeadlineReminder(deadlineInput({ now: new Date('garbage') }))).toEqual({
      kind: 'none',
      reason: 'invalid_now',
    });
  });

  it('changes the event key when the deadline changes while the slot logic stays stable', () => {
    const moved = decideDeadlineReminder(
      deadlineInput({ now: new Date('2026-09-20T02:00:00Z'), deadline: '2026-10-20' }),
    );
    // Both dates sit exactly 30 days from their respective runs…
    expect(moved).toMatchObject({ kind: 'deadline', slot: '30d' });
    const originalKey = deadlineReminderEventKey('app-1', '30d', '2026-10-15');
    const movedKey = deadlineReminderEventKey('app-1', '30d', '2026-10-20');
    // …but the old claim must not swallow the new date's reminder.
    expect(movedKey).not.toBe(originalKey);
  });

  it('is idempotent: identical inputs give identical decisions and event keys', () => {
    const first = decideDeadlineReminder(deadlineInput());
    const second = decideDeadlineReminder(deadlineInput());
    expect(second).toEqual(first);
    expect(deadlineReminderEventKey('app-1', first.kind === 'deadline' ? first.slot : '30d', '2026-10-15')).toBe(
      deadlineReminderEventKey('app-1', '30d', '2026-10-15'),
    );
  });

  it('reduces a datetime deadline to its local calendar date so time-of-day edits never rotate the key', () => {
    const morning = decideDeadlineReminder(
      deadlineInput({ deadline: '2026-10-15T04:00:00Z' }), // 11:00 ICT on Oct 15
    );
    const evening = decideDeadlineReminder(
      deadlineInput({ deadline: '2026-10-15T16:00:00Z' }), // 23:00 ICT, still Oct 15
    );
    expect(evening).toEqual(morning);
    expect(morning).toMatchObject({ kind: 'deadline', slot: '30d' });
    expect(deadlineReminderEventKey('app-1', '30d', '2026-10-15')).toBe(
      deadlineReminderEventKey('app-1', '30d', '2026-10-15'),
    );

    // The flip side of local reduction: past local midnight the effective day
    // really does move (18:00Z = 01:00 ICT on Oct 16), and the policy follows
    // the student's calendar rather than the stored string.
    expect(
      decideDeadlineReminder(deadlineInput({ deadline: '2026-10-15T18:00:00Z' })),
    ).toEqual({ kind: 'none', reason: 'outside_reminder_windows' });
  });
});

describe('decideWeeklyDigest', () => {
  it('sends nothing when there are no actionable tasks', () => {
    const result = decideWeeklyDigest({
      userId: 'user-1',
      now: new Date('2026-09-15T02:00:00Z'),
      timeZone: ICT,
      actionableTasks: 0,
    });
    expect(result.send).toBe(false);
    expect(result.reason).toBe('no_actionable_tasks');
    // The key is still reported so a skipped run logs against the identity a
    // real send would have used.
    expect(result.weekKey).toBe('2026-W38');
  });

  it('sends when actionable tasks exist and keys the week in the user timezone', () => {
    const result = decideWeeklyDigest({
      userId: 'user-1',
      now: new Date('2026-09-15T02:00:00Z'),
      timeZone: ICT,
      actionableTasks: 3,
    });
    expect(result).toEqual({ send: true, reason: 'actionable_tasks', weekKey: '2026-W38' });
  });

  it('formats the week key and rolls it correctly across year boundaries', () => {
    // ISO week 1 of 2025 contains Jan 2 (the first Thursday), so its Monday —
    // Dec 30, 2024 — already carries the NEW year's label.
    const into2025 = decideWeeklyDigest({
      userId: 'user-1',
      now: new Date('2024-12-30T12:00:00Z'),
      timeZone: 'UTC',
      actionableTasks: 1,
    });
    expect(into2025.weekKey).toBe('2025-W01');

    // Dec 28, 2026 is a Monday whose Thursday (Dec 31) is still in 2026, and
    // 2026 has 53 ISO weeks because Jan 1 falls on a Thursday — so true
    // ISO-8601 keeps this week inside 2026-W53. (A "2027-W01" label here would
    // come from a non-ISO scheme.)
    const endOf2026 = decideWeeklyDigest({
      userId: 'user-1',
      now: new Date('2026-12-28T12:00:00Z'),
      timeZone: 'UTC',
      actionableTasks: 1,
    });
    expect(endOf2026.weekKey).toBe('2026-W53');

    for (const weekKey of [into2025.weekKey, endOf2026.weekKey]) {
      expect(weekKey).toMatch(/^\d{4}-W\d{2}$/);
    }
  });

  it('ignores an invalid timezone', () => {
    const result = decideWeeklyDigest({
      userId: 'user-1',
      now: new Date('2026-09-15T02:00:00Z'),
      timeZone: 'Mars/Olympus',
      actionableTasks: 3,
    });
    expect(result).toEqual({ send: false, reason: 'invalid_time_zone', weekKey: '' });
  });
});

describe('deadlineLocalDate', () => {
  it('reduces a datetime deadline to the same local day the decision used', () => {
    // 2026-10-15T18:00:00Z is already Oct 16 01:00 ICT, so the user-local
    // day is Oct 16 even though the UTC date still reads Oct 15.
    const zone = ICT;
    expect(deadlineLocalDate('2026-10-15T18:00:00Z', zone)).toBe('2026-10-16');

    // On Oct 15 (ICT) that deadline is tomorrow → the 1d slot, keyed to
    // Oct 16 — the day the decision acted on.
    expect(
      decideDeadlineReminder(
        deadlineInput({ deadline: '2026-10-15T18:00:00Z', now: new Date('2026-10-15T02:00:00Z') }),
      ),
    ).toEqual({ kind: 'deadline', slot: '1d', applicationId: 'app-1' });
    expect(deadlineReminderEventKey('app-1', '1d', '2026-10-16')).toBe('deadline-1d:app-1:2026-10-16');

    // By Oct 16 (ICT) it is due today — same-day batch — even though the raw
    // UTC instant (Oct 15T18Z) already looks past to naive instant math.
    expect(
      decideDeadlineReminder(
        deadlineInput({ deadline: '2026-10-15T18:00:00Z', now: new Date('2026-10-16T02:00:00Z') }),
      ),
    ).toEqual({ kind: 'same_day_batch', applicationId: 'app-1' });
  });

  it('passes bare calendar dates through unchanged and rejects impossible ones', () => {
    expect(deadlineLocalDate('2026-02-30', ICT)).toBeNull();
    expect(deadlineLocalDate('not-a-date', ICT)).toBeNull();
    expect(deadlineLocalDate('2026-02-28', ICT)).toBe('2026-02-28');
  });
});

describe('event keys', () => {
  it('use the exact documented formats', () => {
    expect(deadlineReminderEventKey('app-9', '7d', '2026-10-15')).toBe(
      'deadline-7d:app-9:2026-10-15',
    );
    expect(sameDayBatchEventKey('app-9', '2026-10-15')).toBe('same-day:app-9:2026-10-15');
    expect(weeklyDigestEventKey('user-1', '2026-W38')).toBe('strategy-digest:user-1:2026-W38');
  });

  it('refuse to mint an identity from a non-calendar value', () => {
    // A malformed component would silently defeat event_key deduplication.
    expect(() => deadlineReminderEventKey('app-9', '7d', '15/10/2026')).toThrow(TypeError);
    expect(() => deadlineReminderEventKey('app-9', '7d', '2026-10-15T23:59:59Z')).toThrow(TypeError);
    expect(() => sameDayBatchEventKey('app-9', 'tomorrow')).toThrow(TypeError);
    expect(() => weeklyDigestEventKey('user-1', '2026-W1')).toThrow(TypeError);
  });
});
