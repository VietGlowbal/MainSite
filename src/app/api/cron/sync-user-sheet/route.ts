import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { readSheetsCredentials, replaceSheetContents } from '@/lib/google-sheets';
import { buildContactSheet, type ProfileLike } from '@/lib/user-contact-rows';

/**
 * GET /api/cron/sync-user-sheet — mirror the user contact export into Google Sheets.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 *
 * Rewrites the whole tab every run rather than appending new sign-ups. With
 * ~400 users that is a single API call, and it is the only version of this that
 * cannot drift: an append-on-signup design silently goes stale the first time a
 * student EDITS their details (which is the entire point of the
 * /auth/complete-profile gate — those users already exist and are filling in
 * blanks), and a single dropped event would leave a hole nobody ever notices.
 * A full rewrite also means the first run backfills every existing user for
 * free, with no separate migration.
 *
 * `auth.users` is not reachable through PostgREST, so the names, emails and
 * sign-in timestamps come from the admin API and are joined to
 * `student_profiles` in memory.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROFILE_COLUMNS =
  'user_id, phone, date_of_birth, age, country, location, nationality, study_level, ' +
  'onboarding_completed, plus_status, marketing_consent, phone_verified';

async function listAllUsers(): Promise<User[]> {
  const admin = createAdminClient();
  const users: User[] = [];
  // 10 pages x 200 = 2000 users. Well clear of the current 409; revisit before
  // it stops being, since a silent truncation here deletes rows from the sheet.
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users;
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const creds = readSheetsCredentials();
  if (!creds) {
    // Not an error: an environment without the Google variables simply has no
    // spreadsheet attached. Reported so a misconfigured deploy is visible in
    // the cron log instead of looking like a successful no-op.
    return NextResponse.json({ ok: true, skipped: 'google-sheets-not-configured' });
  }

  try {
    const admin = createAdminClient();
    const [users, profilesResult] = await Promise.all([
      listAllUsers(),
      admin.from('student_profiles').select(PROFILE_COLUMNS),
    ]);

    if (profilesResult.error) throw profilesResult.error;

    const rows = buildContactSheet(users, (profilesResult.data ?? []) as unknown as ProfileLike[]);
    const { rowsWritten } = await replaceSheetContents(creds, rows);

    return NextResponse.json({
      ok: true,
      users: users.length,
      profiles: profilesResult.data?.length ?? 0,
      rowsWritten,
    });
  } catch (error) {
    console.error('[cron/sync-user-sheet] failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sheet sync failed' },
      { status: 500 },
    );
  }
}
