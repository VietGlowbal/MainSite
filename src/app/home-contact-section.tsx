'use client';

import { useNavigationSession } from '@/components/navigation-session';
import { HomeContact, type ContactState } from '@/features/marketing/ui';
import type { Locale } from '@/lib/i18n/locale';

/**
 * The Home consultation form, with the signed-in student's name and email
 * pre-filled (and locked) when there is one — the handoff's "signed-in" state.
 *
 * The account comes from the navigation session the header already resolves,
 * so this costs no extra auth read, and "/" stays free of per-user server
 * rendering. It lives in app/ rather than in the feature because
 * `@/components` sits above the features in this repo's layering.
 */
export function HomeContactSection({
  action,
  locale,
}: {
  action: (state: ContactState, formData: FormData) => Promise<ContactState>;
  locale: Locale;
}) {
  const session = useNavigationSession();
  const user = session.ready && session.signedIn ? session.user : null;
  const account = user?.email ? { fullName: user.fullName ?? null, email: user.email } : null;

  return <HomeContact action={action} locale={locale} account={account} />;
}
