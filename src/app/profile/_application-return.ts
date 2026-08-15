import type { SupabaseClient } from '@supabase/supabase-js';
import { loadApplicationSummary, verifiedApplicationId } from '@/features/apply/api';
import { applicationIdFromPath, isAllowedInternalReturnPath } from '@/shared/lib';

/**
 * Resolves the "this profile editor was opened from an application" context
 * shared by `/profile/academic`, `/profile/english`, and `/profile/preferences`
 * — the three editors the new Review Profile page's Edit actions link out to.
 *
 * `returnParam` is untrusted (an ordinary query string) on two axes, both
 * checked here: it must be a safe same-origin path
 * (`isAllowedInternalReturnPath`, guards against an open redirect), and the
 * application id extracted from it must genuinely belong to the signed-in
 * student (`verifiedApplicationId`, the same DB-backed check every other
 * `return=` consumer in this codebase already uses). Failing either check
 * degrades to "no application context" — the editor still works exactly as
 * it did before this existed, just without the contextual chrome.
 */
export async function resolveApplicationReturn(
  supabase: SupabaseClient,
  userId: string,
  returnParam: string | undefined,
): Promise<{
  returnTo: string | undefined;
  applicationLabel: string | undefined;
}> {
  if (!returnParam || !isAllowedInternalReturnPath(returnParam)) {
    return { returnTo: undefined, applicationLabel: undefined };
  }

  const applicationId = await verifiedApplicationId(
    supabase,
    userId,
    applicationIdFromPath(returnParam) ?? undefined,
  );
  if (!applicationId) {
    // The path itself is still safe to return to (e.g. it points at the
    // shared, non-application-scoped reflection entry point) — only the
    // application-specific label/contextual copy is unavailable.
    return { returnTo: returnParam, applicationLabel: undefined };
  }

  const summary = await loadApplicationSummary(supabase, userId, applicationId);
  return { returnTo: returnParam, applicationLabel: summary?.label };
}
