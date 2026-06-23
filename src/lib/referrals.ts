import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cookie that carries the ambassador link code from a /c/<code> visit through
 * to the moment the visitor authenticates. httpOnly + 1-year persistence.
 */
export const REF_COOKIE = 'gb_ref';

/**
 * Attribute a user to the ambassador link identified by `refCode` (last-touch).
 *
 * Upserts on user_id, so calling it again moves the attribution to the most
 * recent link the user came through. Idempotent and best-effort — silently
 * no-ops on a blank/unknown code or any error, so it never blocks auth.
 */
export async function captureReferral(
  admin: SupabaseClient,
  userId: string,
  refCode: string | null | undefined,
): Promise<void> {
  const code = refCode?.trim();
  if (!code) return;
  try {
    const { data: link } = await admin
      .from('ambassador_links')
      .select('id, coordinator_id')
      .eq('code', code)
      .maybeSingle();
    if (!link) return;

    await admin.from('ambassador_referrals').upsert(
      {
        user_id: userId,
        link_id: link.id,
        coordinator_id: link.coordinator_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch {
    // Non-fatal: attribution is best-effort and must never break sign-in.
  }
}
