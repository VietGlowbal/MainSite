/**
 * "Has this student answered and saved the onboarding questions?"
 *
 * The flag alone is not the answer, and that is the whole reason this is a
 * function. `onboarding_completed` is written at the END of the wizard, and
 * there are profiles that finished the questions without ever getting it: rows
 * saved by `onboarding-single-page` and `onboarding-globe-quiz` before the flag
 * existed, and rows where the final upsert raced the redirect. Treating those
 * students as new sends someone who has already answered nine questions back to
 * question one, which is the worst version of getting this wrong.
 *
 * So the flag OR the answers it stands for. The two fields checked are the ones
 * every path through onboarding writes, and they are also what
 * `admission-fit.ts` needs before it can rank anything.
 *
 * ⚠️ THIS RULE IS DUPLICATED, and the copies predate this file: `src/proxy.ts`
 * (the /apply gate) and `src/app/auth/callback/route.ts` (the post-sign-in
 * landing) each inline the same expression. They agree today. If you change the
 * definition here, change those two — a student who is "complete" enough for
 * the middleware but not for the CTA gets bounced between two pages.
 *
 * Pure. No I/O.
 */

/** The three columns the rule reads, as they come back from PostgREST. */
export type OnboardingAnswers = {
  onboarding_completed?: boolean | null;
  study_level?: string | null;
  preferred_countries?: unknown;
};

export function onboardingIsComplete(profile: OnboardingAnswers | null | undefined): boolean {
  if (profile == null) return false;
  if (profile.onboarding_completed === true) return true;

  // `preferred_countries` is a jsonb column, so it is `unknown` until proven
  // otherwise — an older row can hold a string, or null, where this expects a
  // list. `Array.isArray` is doing real work here, not appeasing the type.
  return (
    Boolean(profile.study_level) &&
    Array.isArray(profile.preferred_countries) &&
    profile.preferred_countries.length > 0
  );
}
