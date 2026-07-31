import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/server/db/server';

/**
 * "Is this caller signed in, and do they own this application?" — once.
 *
 * WHY THIS EXISTS. Every route under /api/applications/[id] repeats the same
 * eleven lines: get the session, 401 if absent, select the application with
 * `.eq('user_id', user.id)`, 404 if it misses. That was fine at three routes.
 * Feature 2 adds fourteen more, and the failure mode of a copied auth check is
 * that one copy quietly loses the ownership predicate — a bug that returns
 * another student's CV and that no type checks.
 *
 * WHY IT RETURNS A RESPONSE RATHER THAN THROWING. Route handlers have to return
 * a Response, and a thrown error in Next.js becomes a 500 with a digest, not a
 * 401. Returning the response the caller should send keeps the failure explicit
 * at the call site:
 *
 *     const owner = await requireApplicationOwner(id);
 *     if ('response' in owner) return owner.response;
 *     // owner.user, owner.application and owner.supabase are all narrowed here
 *
 * WHY 404 AND NOT 403 FOR A NON-OWNED APPLICATION. A 403 confirms the id exists.
 * Application ids are uuids so they are not guessable, but distinguishing
 * "yours" from "someone else's" is free information about another student, and
 * there is no caller that needs it. Same reason the page-level equivalent calls
 * notFound() rather than rendering a permission error.
 */

/** The `course_applications` row plus its joined `courses` row. */
export type OwnedApplication = {
  id: string;
  user_id: string;
  university_id: number | null;
  university_name: string | null;
  course_name: string | null;
  course_url: string | null;
  degree_level: string | null;
  subject: string | null;
  status: string | null;
  deadline: string | null;
  ai_summary: string | null;
  parse_status: string | null;
  courses: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type ApplicationOwnerResult =
  | { response: NextResponse }
  | { supabase: SupabaseClient; user: User; application: OwnedApplication };

export async function requireApplicationOwner(
  applicationId: string,
): Promise<ApplicationOwnerResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  /*
   * A malformed id would make Postgres raise 22P02 (invalid uuid) rather than
   * return no rows, which would surface as a 500. Checked here so a bad path
   * segment is the 404 it should be.
   */
  if (!isUuid(applicationId)) {
    return { response: NextResponse.json({ error: 'Application not found' }, { status: 404 }) };
  }

  const { data, error } = await supabase
    .from('course_applications')
    .select('*, courses (*)')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return { response: NextResponse.json({ error: 'Application not found' }, { status: 404 }) };
  }

  return { supabase, user, application: data as OwnedApplication };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
