import { describe, expect, it } from 'vitest';
import { onboardingIsComplete } from './completion';

/**
 * This predicate decides where the Home hero's CTA sends someone, and the same
 * rule (inlined) decides whether src/proxy.ts lets them onto /apply. Getting it
 * wrong in either direction is user-visible:
 *
 *   false negative — a student who answered nine questions is asked again
 *   false positive — a student with no answers lands on a page that needs them
 *
 * So the cases below are the shapes a real `student_profiles` row comes back
 * in, not just the two obvious ones.
 */

describe('onboardingIsComplete', () => {
  it('trusts the flag on its own', () => {
    expect(onboardingIsComplete({ onboarding_completed: true })).toBe(true);
  });

  it('accepts a profile that has the answers but never got the flag', () => {
    // Rows written by onboarding-single-page / onboarding-globe-quiz before the
    // flag existed, and rows whose final upsert raced the redirect.
    expect(
      onboardingIsComplete({
        onboarding_completed: false,
        study_level: 'undergraduate',
        preferred_countries: ['UK', 'Australia'],
      }),
    ).toBe(true);
  });

  it('needs BOTH answers, not either', () => {
    expect(
      onboardingIsComplete({ study_level: 'masters', preferred_countries: [] }),
    ).toBe(false);
    expect(onboardingIsComplete({ preferred_countries: ['Canada'] })).toBe(false);
  });

  it('treats a visitor with no profile row as new', () => {
    expect(onboardingIsComplete(null)).toBe(false);
    expect(onboardingIsComplete(undefined)).toBe(false);
    expect(onboardingIsComplete({})).toBe(false);
  });

  it('does not mistake a non-list preferred_countries for answers', () => {
    // jsonb: an older row can hold a bare string where this expects a list.
    // `'UK'.length > 0` is true, so without the Array.isArray guard this row
    // would read as complete and skip a student past onboarding.
    expect(
      onboardingIsComplete({ study_level: 'phd', preferred_countries: 'UK' }),
    ).toBe(false);
    expect(
      onboardingIsComplete({ study_level: 'phd', preferred_countries: null }),
    ).toBe(false);
  });

  it('does not read a null flag as completion', () => {
    // The column is `boolean not null default false`, but a profile row can
    // predate the migration that added it, in which case PostgREST returns
    // null. Null is "we do not know", and the answers below decide instead.
    expect(onboardingIsComplete({ onboarding_completed: null })).toBe(false);
    expect(
      onboardingIsComplete({
        onboarding_completed: null,
        study_level: 'undergraduate',
        preferred_countries: ['UK'],
      }),
    ).toBe(true);
  });
});
