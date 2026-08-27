import type { SupabaseClient } from '@supabase/supabase-js';

export class ApplicationNotOwnedError extends Error {
  constructor() {
    super('Application not found');
    this.name = 'ApplicationNotOwnedError';
  }
}

export class ApplicationLookupError extends Error {
  constructor() {
    super('Application lookup failed');
    this.name = 'ApplicationLookupError';
  }
}

/**
 * `applicationId` arrives from the client, ultimately derived from a
 * `?return=` URL — untrusted, the same caveat
 * `src/app/ai-strategy/reflection/application-nav-from-return.tsx` documents
 * for the identical situation. An id that does not belong to this user is
 * treated exactly like no id at all by every caller (falls back to the
 * legacy, non-application-scoped behaviour), never rejected outright — a
 * forged id cannot do anything worse than the pre-existing global behaviour
 * every caller already had before per-application state existed.
 */
export async function verifiedApplicationId(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string | undefined,
  options?: { strict?: boolean },
): Promise<string | undefined> {
  if (!applicationId) return undefined;
  const { data, error } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error && options?.strict) throw new ApplicationLookupError();
  if (!data && options?.strict) throw new ApplicationNotOwnedError();
  return data ? applicationId : undefined;
}
