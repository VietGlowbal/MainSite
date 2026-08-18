import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/send-email';
import { SITE_URL } from '@/lib/site-url';
import { onboardingCompleteEmail, onboardingReminderEmail } from '@/lib/emails/lifecycle';

type ProfileRow = {
  user_id: string;
  onboarding_completed: boolean | null;
  onboarding_completed_at: string | null;
};

type PreferenceRow = {
  user_id: string;
  product_updates: boolean | null;
};

const HOUR = 60 * 60 * 1000;

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

/**
 * Daily lifecycle email run (02:00 UTC / 09:00 Vietnam).
 *
 * Narrow 24h eligibility windows intentionally mean a user can only be picked
 * up by one scheduled run for each reminder even before the email_deliveries
 * schema is installed. The persistent event keys remain the authoritative
 * duplicate protection once supabase-email-system.sql has been applied.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const users = await listAllUsers();
  const ids = users.map((user) => user.id);

  if (ids.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0 });
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
    .select('user_id,product_updates')
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
      const completedAge = ageHours(profile.onboarding_completed_at, now);
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

    const accountAge = ageHours(user.created_at, now);
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

  return NextResponse.json({ processed: users.length, sent, skipped, failed });
}
