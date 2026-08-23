import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/send-email';
import { SITE_URL } from '@/lib/site-url';
import {
  deadlineLocalDate,
  deadlineReminderEventKey,
  decideDeadlineReminder,
  decideWeeklyDigest,
  sameDayBatchEventKey,
  weeklyDigestEventKey,
  type ReminderSlot,
} from '@/lib/email/planner-reminders';
import {
  deadlineReminderEmail,
  onboardingCompleteEmail,
  onboardingReminderEmail,
  weeklyStrategyDigestEmail,
} from '@/lib/emails/lifecycle';
import { CORE3_PLAN_PRODUCER } from '@/features/ai-strategy-dashboard/domain';

type ProfileRow = {
  user_id: string;
  onboarding_completed: boolean | null;
  onboarding_completed_at: string | null;
};

type PreferenceRow = {
  user_id: string;
  product_updates: boolean | null;
  deadline_reminders: boolean | null;
  weekly_strategy_digest: boolean | null;
  timezone: string | null;
};

type ApplicationDeadlineRow = {
  id: string;
  user_id: string;
  status: string | null;
  deadline: string | null;
  deadline_source: string | null;
  university_name: string | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

const HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;
const BATCH_SIZE = 200;

/**
 * Product audience default. The preferences column is optional per row; a
 * student who never stored a zone still lives on a calendar, and GlowBal's
 * calendar is Vietnam-first (docs/email-system.md §Preferences).
 */
const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Application states past their application deadline's usefulness. A submitted
 * or decided application has no application deadline left to remind about —
 * docs/email-system.md §"Planner and deadlines" scopes these reminders to
 * deadlines that still matter.
 */
const TERMINAL_APPLICATION_STATUSES = new Set([
  'submitted',
  'offer_received',
  'rejected',
  'withdrawn',
  'archived',
]);

const SLOT_DAYS: Record<ReminderSlot, number> = { '30d': 30, '7d': 7, '1d': 1 };

function ageHours(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? (now - value) / HOUR : null;
}

function firstName(metadata: Record<string, unknown> | undefined): string | undefined {
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : '';
  return fullName ? fullName.split(/\s+/)[0] : undefined;
}

async function listAllUsers(): Promise<User[]> {
  const admin = createAdminClient();
  const users: User[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users;
}

/* ── Planner reminder wiring (Part 5.5–5.8) ──────────────────────────────── */

/**
 * Map `deadline_source` → authority. Mirrors authorityFromDeadlineSource in
 * fetch-planning-context-sources.ts; the reminder module's contract keeps this
 * mapping caller-side so the pure policy stays free of storage vocabulary.
 */
function mapDeadlineAuthority(
  deadlineSource: string | null,
): 'official' | 'user_set' | 'derived' | 'unknown' {
  if (!deadlineSource) return 'unknown';
  const lower = deadlineSource.toLowerCase();
  if (lower === 'user_set' || lower === 'manual') return 'user_set';
  if (lower === 'official' || lower === 'university_page' || lower === 'course_page') return 'official';
  if (lower === 'extracted_from_page' || lower === 'ai_extracted') return 'derived';
  return 'unknown';
}

function prefStateFor(userId: string, prefs: Map<string, PreferenceRow>) {
  const pref = prefs.get(userId);
  return {
    // No preference row means the documented defaults: reminders enabled.
    deadlineReminders: pref?.deadline_reminders !== false,
    weeklyDigest: pref?.weekly_strategy_digest !== false,
    timeZone: pref?.timezone?.trim() || DEFAULT_TIME_ZONE,
  };
}

function chunksOf<T>(items: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

/** Epoch millis of a YYYY-MM-DD at UTC midnight — the DST-immune anchor the
    policy module uses for all calendar arithmetic (see planner-reminders.ts). */
function utcMidnight(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : Number.NaN;
}

function isoFromUtcMillis(millis: number): string {
  return new Date(millis).toISOString().slice(0, 10);
}

function calendarDaysFromToday(todayIso: string, dayIso: string): number {
  return Math.round((utcMidnight(dayIso) - utcMidnight(todayIso)) / MS_PER_DAY);
}

function formatEnDay(isoDate: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(
    new Date(utcMidnight(isoDate)),
  );
}

/** 'Aug 24 – Aug 30' — the Monday–Sunday span of the ISO week containing today. */
function weekLabelFor(todayIso: string): string {
  const daysSinceMonday = (new Date(utcMidnight(todayIso)).getUTCDay() + 6) % 7;
  const monday = utcMidnight(todayIso) - daysSinceMonday * MS_PER_DAY;
  const sunday = monday + 6 * MS_PER_DAY;
  const range = { month: 'short', day: 'numeric' } as const;
  return `${formatEnDay(isoFromUtcMillis(monday), range)} – ${formatEnDay(isoFromUtcMillis(sunday), range)}`;
}

function plannerUrl(applicationId: string): string {
  return `${SITE_URL}/ai-strategy/${applicationId}/planner`;
}

/**
 * Deadline reminders: 30/7/1-day slots plus the same-day batch, one email per
 * application under its own stable event key. Same-day items are sent
 * individually rather than merged because each application claims its own
 * `same-day:` key (so a partial retry cannot re-send another application's
 * mail) and docs/email-system.md asks for combination only "where practical"
 * — with per-application claims already correct, merging becomes a later,
 * purely presentational change.
 */
async function plannerDeadlineReminders(
  admin: AdminClient,
  emailById: Map<string, string>,
  prefs: Map<string, PreferenceRow>,
  now: Date,
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await admin
      .from('course_applications')
      .select('id,user_id,status,deadline,deadline_source,university_name')
      .not('deadline', 'is', null)
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) throw error;

    const rows = (data ?? []) as ApplicationDeadlineRow[];
    for (const row of rows) {
      try {
        if (!row.deadline || TERMINAL_APPLICATION_STATUSES.has(row.status ?? '')) {
          skipped += 1;
          continue;
        }
        const to = emailById.get(row.user_id);
        if (!to) {
          skipped += 1;
          continue;
        }
        const prefState = prefStateFor(row.user_id, prefs);
        if (!prefState.deadlineReminders) {
          skipped += 1;
          continue;
        }

        const decision = decideDeadlineReminder({
          applicationId: row.id,
          deadline: row.deadline,
          authority: mapDeadlineAuthority(row.deadline_source),
          timeZone: prefState.timeZone,
          now,
        });
        if (decision.kind === 'none') {
          skipped += 1;
          continue;
        }

        // Key builders take the USER-LOCAL date the decision acted on — never
        // the raw stored value, whose datetime part would rotate keys.
        const localDate = deadlineLocalDate(row.deadline, prefState.timeZone);
        if (!localDate) {
          skipped += 1;
          continue;
        }

        const university = row.university_name?.trim() || 'Your application';
        const daysRemaining = decision.kind === 'deadline' ? SLOT_DAYS[decision.slot] : 0;
        const eventKey =
          decision.kind === 'deadline'
            ? deadlineReminderEventKey(row.id, decision.slot, localDate)
            : sameDayBatchEventKey(row.id, localDate);

        const result = await sendEmail({
          to,
          subject: `${university}: deadline ${formatEnDay(localDate, { weekday: 'short', month: 'short', day: 'numeric' })}`,
          html: deadlineReminderEmail({
            university,
            deadlineLabel: formatEnDay(localDate, { weekday: 'long', month: 'long', day: 'numeric' }),
            daysRemaining,
            url: plannerUrl(row.id),
          }),
          text: `${university} deadline: ${localDate}. Open your planner: ${plannerUrl(row.id)}`,
          category: 'product_reminder',
          template: 'deadline-reminder',
          userId: row.user_id,
          idempotencyKey: eventKey,
          tags:
            decision.kind === 'deadline'
              ? { kind: 'deadline-reminder', slot: decision.slot }
              : { kind: 'same-day-deadline' },
        });
        if (result.ok && !result.skipped) {
          sent += 1;
          console.log(`[cron:planner-deadline] sent ${eventKey}`);
        } else if (result.ok) skipped += 1;
        else failed += 1;
      } catch (error) {
        failed += 1;
        console.error(
          '[cron:planner-deadline] item failed',
          JSON.stringify({ applicationId: row.id, error: error instanceof Error ? error.message : String(error) }),
        );
      }
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return { sent, skipped, failed };
}

type DigestMicroRow = {
  id: string;
  step_id: string;
  title: string | null;
  status: string | null;
  deadline: string | null;
};

type DigestTask = { applicationId: string; title: string; dayIso: string };

/**
 * Weekly strategy digest: one email per user per ISO week summarising overdue
 * and next-7-days canonical planner tasks. Zero actionable tasks → no email
 * (decideWeeklyDigest refuses an empty digest; an all-clear mail trains
 * students to ignore the next one).
 */
async function weeklyStrategyDigest(
  admin: AdminClient,
  emailById: Map<string, string>,
  prefs: Map<string, PreferenceRow>,
  now: Date,
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Active applications → owner (terminal states have no live plan work).
  const appOwner = new Map<string, string>();
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await admin
      .from('course_applications')
      .select('id,user_id,status')
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; user_id: string; status: string | null }>) {
      if (!TERMINAL_APPLICATION_STATUSES.has(row.status ?? '')) appOwner.set(row.id, row.user_id);
    }
    if ((data ?? []).length < BATCH_SIZE) break;
  }
  const applicationIds = [...appOwner.keys()];
  if (applicationIds.length === 0) return { sent, skipped, failed };

  // Canonical Core 3 hierarchy only — the legacy board is not a digest source.
  const planByApplication = new Map<string, string>();
  for (const chunk of chunksOf(applicationIds)) {
    const { data, error } = await admin
      .from('application_plans')
      .select('id,application_id')
      .in('application_id', chunk)
      .eq('producer', CORE3_PLAN_PRODUCER)
      .is('archived_at', null);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; application_id: string }>) {
      planByApplication.set(row.application_id, row.id);
    }
  }
  const applicationByPlan = new Map([...planByApplication].map(([appId, planId]) => [planId, appId]));
  const planIds = [...planByApplication.values()];
  if (planIds.length === 0) return { sent, skipped, failed };

  const phaseByPlan = new Map<string, string>();
  for (const chunk of chunksOf(planIds)) {
    const { data, error } = await admin
      .from('application_plan_phases')
      .select('id,plan_id')
      .in('plan_id', chunk)
      .is('archived_at', null);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; plan_id: string }>) phaseByPlan.set(row.id, row.plan_id);
  }
  const phaseIds = [...phaseByPlan.keys()];
  if (phaseIds.length === 0) return { sent, skipped, failed };

  const stepByPhase = new Map<string, string>();
  for (const chunk of chunksOf(phaseIds)) {
    const { data, error } = await admin
      .from('application_plan_steps')
      .select('id,phase_id')
      .in('phase_id', chunk)
      .is('archived_at', null);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ id: string; phase_id: string }>) stepByPhase.set(row.id, row.phase_id);
  }
  const stepIds = [...stepByPhase.keys()];
  if (stepIds.length === 0) return { sent, skipped, failed };

  // Completed micro-steps are done work, never digest material; blocked and
  // needs_review stay — they are exactly what a student must act on.
  const tasksByUser = new Map<string, DigestTask[]>();
  for (const chunk of chunksOf(stepIds)) {
    const { data, error } = await admin
      .from('application_plan_micro_steps')
      .select('id,step_id,title,status,deadline')
      .in('step_id', chunk)
      .is('archived_at', null)
      .neq('status', 'completed')
      .not('deadline', 'is', null);
    if (error) throw error;
    for (const row of (data ?? []) as DigestMicroRow[]) {
      const stepId = stepByPhase.has(row.step_id) ? row.step_id : undefined;
      const planId = stepId ? phaseByPlan.get(stepByPhase.get(stepId) ?? '') : undefined;
      const applicationId = planId ? applicationByPlan.get(planId) : undefined;
      const userId = applicationId ? appOwner.get(applicationId) : undefined;
      if (!applicationId || !userId || !row.deadline) continue;
      const list = tasksByUser.get(userId) ?? [];
      list.push({ applicationId, title: row.title?.trim() || 'Untitled task', dayIso: row.deadline.slice(0, 10) });
      tasksByUser.set(userId, list);
    }
  }

  for (const [userId, tasks] of tasksByUser) {
    try {
      const to = emailById.get(userId);
      if (!to) {
        skipped += 1;
        continue;
      }
      const prefState = prefStateFor(userId, prefs);
      if (!prefState.weeklyDigest) {
        skipped += 1;
        continue;
      }

      const todayIso = deadlineLocalDate(now.toISOString(), prefState.timeZone);
      if (!todayIso) {
        skipped += 1;
        continue;
      }

      const overdue: DigestTask[] = [];
      const upcoming: DigestTask[] = [];
      for (const task of tasks) {
        const distance = calendarDaysFromToday(todayIso, task.dayIso);
        if (distance < 0) overdue.push(task);
        else if (distance <= 7) upcoming.push(task);
      }
      overdue.sort((a, b) => a.dayIso.localeCompare(b.dayIso));
      upcoming.sort((a, b) => a.dayIso.localeCompare(b.dayIso));

      const decision = decideWeeklyDigest({
        userId,
        now,
        timeZone: prefState.timeZone,
        actionableTasks: overdue.length + upcoming.length,
      });
      if (!decision.send) {
        skipped += 1;
        continue;
      }

      const weekLabel = weekLabelFor(todayIso);
      const focusApplication = (upcoming[0] ?? overdue[0]).applicationId;
      const url = plannerUrl(focusApplication);
      const render = (task: DigestTask, prefix: string) => ({
        title: task.title,
        dueLabel: `${prefix}${formatEnDay(task.dayIso, { weekday: 'short', month: 'short', day: 'numeric' })}`,
      });
      const result = await sendEmail({
        to,
        subject: `Your GlowBal plan for ${weekLabel}`,
        html: weeklyStrategyDigestEmail({
          url,
          weekLabel,
          overdue: overdue.map((task) => render(task, 'Was due ')),
          upcoming: upcoming.map((task) =>
            render(task, task.dayIso === todayIso ? 'Due today · ' : 'Due '),
          ),
        }),
        text: `Your GlowBal plan for ${weekLabel}: ${overdue.length} overdue, ${upcoming.length} due within 7 days. Open your planner: ${url}`,
        category: 'product_reminder',
        template: 'weekly-strategy-digest',
        userId,
        idempotencyKey: weeklyDigestEventKey(userId, decision.weekKey),
        tags: { kind: 'weekly-strategy-digest', week: decision.weekKey },
      });
      if (result.ok && !result.skipped) {
        sent += 1;
        console.log(`[cron:strategy-digest] sent user=${userId} week=${decision.weekKey}`);
      } else if (result.ok) skipped += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        '[cron:strategy-digest] item failed',
        JSON.stringify({ userId, error: error instanceof Error ? error.message : String(error) }),
      );
    }
  }

  return { sent, skipped, failed };
}

/* ── Cron entrypoint ──────────────────────────────────────────────────────── */

/**
 * Daily lifecycle email run (02:00 UTC / 09:00 Vietnam).
 *
 * Narrow 24h eligibility windows intentionally mean a user can only be picked
 * up by one scheduled run for each reminder even before the email_deliveries
 * schema is installed. The persistent event keys remain the authoritative
 * duplicate protection once supabase-email-system.sql has been applied.
 *
 * Part 5 adds two planner processors after the onboarding pass: deadline
 * reminders (30/7/1-day + same-day) and the weekly strategy digest. Each runs
 * its own try/catch so a planner-side failure never blocks onboarding mail,
 * and every send is claimed under the stable event key built by
 * src/lib/email/planner-reminders.ts.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const users = await listAllUsers();
  const ids = users.map((user) => user.id);

  if (ids.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0 });
  }

  const emailById = new Map<string, string>();
  for (const user of users) {
    if (user.email && user.email_confirmed_at) emailById.set(user.id, user.email);
  }

  const { data: profileData, error: profileError } = await admin
    .from('student_profiles')
    .select('user_id,onboarding_completed,onboarding_completed_at')
    .in('user_id', ids);
  if (profileError) throw profileError;

  const profiles = new Map(
    ((profileData ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
  );

  // Preferences are optional during rollout. No row means the documented
  // default of product reminders enabled. A missing table also fails open.
  let preferenceRows: PreferenceRow[] = [];
  const { data: prefData, error: prefError } = await admin
    .from('email_preferences')
    .select('user_id,product_updates,deadline_reminders,weekly_strategy_digest,timezone')
    .in('user_id', ids);
  if (!prefError) preferenceRows = (prefData ?? []) as PreferenceRow[];
  const preferences = new Map(preferenceRows.map((row) => [row.user_id, row]));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (!user.email || !user.email_confirmed_at) {
      skipped += 1;
      continue;
    }

    const profile = profiles.get(user.id);
    const pref = preferences.get(user.id);
    const name = firstName(user.user_metadata as Record<string, unknown> | undefined);

    if (profile?.onboarding_completed) {
      const completedAge = ageHours(profile.onboarding_completed_at, now.getTime());
      if (completedAge !== null && completedAge >= 0 && completedAge < 24) {
        const result = await sendEmail({
          to: user.email,
          subject: 'Your GlowBal profile is ready',
          html: onboardingCompleteEmail({ firstName: name, discoveryUrl: `${SITE_URL}/universities` }),
          text: `Your GlowBal profile is ready. Discover universities that fit you: ${SITE_URL}/universities`,
          category: 'product_transactional',
          template: 'onboarding-complete',
          userId: user.id,
          idempotencyKey: `onboarding-complete:${user.id}`,
          tags: { kind: 'onboarding-complete' },
        });
        if (result.ok && !result.skipped) sent += 1;
        else if (result.ok) skipped += 1;
        else failed += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    if (pref?.product_updates === false) {
      skipped += 1;
      continue;
    }

    const accountAge = ageHours(user.created_at, now.getTime());
    if (accountAge === null) {
      skipped += 1;
      continue;
    }

    const reminder = accountAge >= 24 && accountAge < 48
      ? { number: 1, final: false }
      : accountAge >= 96 && accountAge < 120
        ? { number: 2, final: true }
        : null;

    if (!reminder) {
      skipped += 1;
      continue;
    }

    const result = await sendEmail({
      to: user.email,
      subject: reminder.final ? 'Your GlowBal profile is still waiting' : 'Continue your GlowBal profile',
      html: onboardingReminderEmail({
        firstName: name,
        continueUrl: `${SITE_URL}/onboarding`,
        finalReminder: reminder.final,
      }),
      text: `Continue your GlowBal profile to unlock personalised matching and strategy: ${SITE_URL}/onboarding`,
      category: 'product_reminder',
      template: 'onboarding-reminder',
      userId: user.id,
      idempotencyKey: `onboarding-reminder-${reminder.number}:${user.id}`,
      tags: { kind: 'onboarding-reminder', reminder: String(reminder.number) },
    });

    if (result.ok && !result.skipped) sent += 1;
    else if (result.ok) skipped += 1;
    else failed += 1;
  }

  const plannerReminders = await plannerDeadlineReminders(admin, emailById, preferences, now).catch(
    (error: unknown) => {
      console.error('[cron:planner-deadline] batch failed', error);
      return { sent: 0, skipped: 0, failed: 0 };
    },
  );
  const digest = await weeklyStrategyDigest(admin, emailById, preferences, now).catch(
    (error: unknown) => {
      console.error('[cron:strategy-digest] batch failed', error);
      return { sent: 0, skipped: 0, failed: 0 };
    },
  );

  return NextResponse.json({
    processed: users.length,
    sent,
    skipped,
    failed,
    plannerDeadlineReminders: plannerReminders,
    weeklyStrategyDigest: digest,
  });
}
