import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Wiring tests for the planner processors inside the daily lifecycle cron.
 * The decision policy lives in src/lib/email/planner-reminders.test.ts and the
 * rendering in src/lib/emails/lifecycle.test.ts — what is pinned HERE is the
 * seam: which rows get mailed, under which stable event keys, and which gates
 * (preferences, terminal statuses, empty digests) stay closed.
 */

type Row = Record<string, unknown>;

const isAuthorizedCron = vi.fn(() => true);

/** The subset of SendEmailOptions these assertions look at. */
type SentMail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category: string;
  template: string;
  userId?: string;
  idempotencyKey?: string;
};

const sendEmail = vi.fn(async (mail: SentMail) => ({
  ok: true as const,
  messageId: `msg-${mail.idempotencyKey ?? mail.template}`,
}));

vi.mock('@/lib/cron-auth', () => ({ isAuthorizedCron }));
vi.mock('@/lib/send-email', () => ({ sendEmail }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ auth: { admin: { listUsers } }, from }) }));

type AuthUser = {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  user_metadata: Record<string, unknown>;
};

const USER: AuthUser = {
  id: 'user-1',
  email: 'student@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  user_metadata: { full_name: 'An Nguyen' },
};

function listUsers() {
  return Promise.resolve({ data: { users: [USER] }, error: null });
}

let profileRows: Row[] = [];
let preferenceRows: Row[] = [];
/** Rows served to the deadline query (`deadline IS NOT NULL`). */
let deadlineRows: Row[] = [];
/** Rows served to the plain active-application query. */
let activeApplicationRows: Row[] = [];
let planRows: Row[] = [];
let phaseRows: Row[] = [];
let stepRows: Row[] = [];
let microRows: Row[] = [];

function rowsFor(table: string, filters: Array<{ kind: string; col: string }>): Row[] {
  switch (table) {
    case 'student_profiles':
      return profileRows;
    case 'email_preferences':
      return preferenceRows;
    // The deadline processor filters `deadline IS NOT NULL`; the digest
    // processor reads every active application. Same table, two shapes.
    case 'course_applications':
      return filters.some((filter) => filter.kind === 'not-is-null' && filter.col === 'deadline')
        ? deadlineRows
        : activeApplicationRows;
    case 'application_plans':
      return planRows;
    case 'application_plan_phases':
      return phaseRows;
    case 'application_plan_steps':
      return stepRows;
    case 'application_plan_micro_steps':
      return microRows;
    default:
      throw new Error(`Unexpected table in test: ${table}`);
  }
}

function from(table: string) {
  const filters: Array<{ kind: string; col: string; val: unknown }> = [];
  const apply = (rows: Row[]): Row[] =>
    rows.filter((row) =>
      filters.every((filter) => {
        if (filter.kind === 'neq') return row[filter.col] !== filter.val;
        if (filter.kind === 'not-is-null') return row[filter.col] !== null && row[filter.col] !== undefined;
        if (filter.kind === 'is-null') return row[filter.col] === null || row[filter.col] === undefined;
        return true;
      }),
    );
  const query = {
    select: () => query,
    in: () => query,
    eq: () => query,
    is: (col: string, val: unknown) => {
      if (val === null) filters.push({ kind: 'is-null', col, val });
      return query;
    },
    neq: (col: string, val: unknown) => {
      filters.push({ kind: 'neq', col, val });
      return query;
    },
    not: (col: string, _op: string, val: unknown) => {
      // `.not(col, 'is', null)` encodes IS NOT NULL.
      if (val === null) filters.push({ kind: 'not-is-null', col, val });
      return query;
    },
    range: async () => ({ data: apply(rowsFor(table, filters)), error: null }),
    then: (resolve: (value: { data: Row[]; error: null }) => void) =>
      Promise.resolve({ data: apply(rowsFor(table, filters)), error: null }).then(resolve),
  };
  return { select: () => query };
}

async function call() {
  const response = await GET(new NextRequest('http://localhost/api/cron/lifecycle-emails'));
  return response.json();
}

const { GET } = await import('./route');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-15T02:00:00Z')); // 09:00 ICT, Tuesday
  sendEmail.mockClear();
  isAuthorizedCron.mockReturnValue(true);
  profileRows = [];
  preferenceRows = [
    {
      user_id: 'user-1',
      product_updates: true,
      deadline_reminders: true,
      weekly_strategy_digest: true,
      timezone: 'Asia/Ho_Chi_Minh',
    },
  ];
  deadlineRows = [];
  activeApplicationRows = [];
  planRows = [];
  phaseRows = [];
  stepRows = [];
  microRows = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('lifecycle-emails cron: planner processors', () => {
  it('rejects unauthorized runs before touching any data', async () => {
    isAuthorizedCron.mockReturnValue(false);

    const response = await GET(new NextRequest('http://localhost/api/cron/lifecycle-emails'));

    expect(response.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('mails the 7-day deadline reminder under its stable event key', async () => {
    deadlineRows = [
      {
        id: 'app-9',
        user_id: 'user-1',
        status: 'preparing',
        deadline: '2026-09-22',
        deadline_source: 'official',
        university_name: 'RMIT Vietnam',
      },
    ];

    const body = await call();

    expect(body.plannerDeadlineReminders).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student@example.com',
        category: 'product_reminder',
        template: 'deadline-reminder',
        idempotencyKey: 'deadline-7d:app-9:2026-09-22',
        userId: 'user-1',
      }),
    );
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.subject).toContain('RMIT Vietnam');
    expect(mail.html).toContain(`/ai-strategy/app-9/planner`);
    expect(mail.html).toContain('7 days to go');
  });

  it('skips the reminder when the deadline_reminders preference is off', async () => {
    preferenceRows = [
      {
        user_id: 'user-1',
        product_updates: true,
        deadline_reminders: false,
        weekly_strategy_digest: true,
        timezone: 'Asia/Ho_Chi_Minh',
      },
    ];
    deadlineRows = [
      {
        id: 'app-9',
        user_id: 'user-1',
        status: 'preparing',
        deadline: '2026-09-22',
        deadline_source: 'official',
        university_name: 'RMIT Vietnam',
      },
    ];

    const body = await call();

    expect(body.plannerDeadlineReminders).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('never mails a terminal-status application even inside a reminder window', async () => {
    deadlineRows = [
      {
        id: 'app-9',
        user_id: 'user-1',
        status: 'submitted',
        deadline: '2026-09-14', // yesterday — excluded twice over
        deadline_source: 'official',
        university_name: 'RMIT Vietnam',
      },
      {
        id: 'app-10',
        user_id: 'user-1',
        status: 'withdrawn',
        deadline: '2026-09-22', // exactly 7 days out, but decided already
        deadline_source: 'user_set',
        university_name: 'UEH',
      },
    ];

    const body = await call();

    expect(body.plannerDeadlineReminders).toEqual({ sent: 0, skipped: 2, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends the weekly digest once, keyed by ISO week, from canonical micro-steps', async () => {
    activeApplicationRows = [{ id: 'app-9', user_id: 'user-1', status: 'preparing' }];
    planRows = [{ id: 'plan-1', application_id: 'app-9' }];
    phaseRows = [{ id: 'ph-1', plan_id: 'plan-1' }];
    stepRows = [{ id: 'st-1', phase_id: 'ph-1' }];
    microRows = [
      {
        id: 'ms-1',
        step_id: 'st-1',
        title: 'Draft SOP paragraph two',
        status: 'in_progress',
        deadline: '2026-09-16', // tomorrow
      },
      {
        id: 'ms-2',
        step_id: 'st-1',
        title: 'Book IELTS speaking practice',
        status: 'blocked',
        deadline: '2026-08-30', // overdue
      },
    ];

    const body = await call();

    expect(body.weeklyStrategyDigest).toEqual({ sent: 1, skipped: 0, failed: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'product_reminder',
        template: 'weekly-strategy-digest',
        userId: 'user-1',
        // 2026-09-15 falls in ISO week 38 (Jan 1 2026 is a Thursday).
        idempotencyKey: 'strategy-digest:user-1:2026-W38',
      }),
    );
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.html).toContain('Was due Sun, Aug 30');
    expect(mail.html).toContain('Due Wed, Sep 16');
    expect(mail.html).toContain('/ai-strategy/app-9/planner');
    expect(mail.text).toContain('1 overdue, 1 due within 7 days');
  });

  it('refuses an empty digest instead of mailing an all-clear', async () => {
    activeApplicationRows = [{ id: 'app-9', user_id: 'user-1', status: 'preparing' }];
    planRows = [{ id: 'plan-1', application_id: 'app-9' }];
    phaseRows = [{ id: 'ph-1', plan_id: 'plan-1' }];
    stepRows = [{ id: 'st-1', phase_id: 'ph-1' }];
    microRows = [
      {
        id: 'ms-1',
        step_id: 'st-1',
        title: 'Already done',
        status: 'completed',
        deadline: '2026-09-16',
      },
      {
        id: 'ms-2',
        step_id: 'st-1',
        title: 'Far future task',
        status: 'in_progress',
        deadline: '2026-12-01', // outside the 7-day window
      },
    ];

    const body = await call();

    expect(body.weeklyStrategyDigest).toEqual({ sent: 0, skipped: 1, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('keeps digest material out of archived hierarchies and legacy producers', async () => {
    // The plan row carries producer/archived columns; this fixture simply has
    // NO matching plan for the application, which is what both filters reduce
    // to for the digest walk.
    activeApplicationRows = [{ id: 'app-9', user_id: 'user-1', status: 'preparing' }];
    planRows = [];

    const body = await call();

    expect(body.weeklyStrategyDigest).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
