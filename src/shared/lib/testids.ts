/**
 * Stable E2E selectors.
 *
 * This file is a CONTRACT between the Playwright suite and the UI. The markup
 * these ids are attached to today is going to be deleted and rewritten from the
 * Figma design — the ids are what survives that rewrite, and they are the only
 * reason a 6-flow E2E suite can outlive a full redesign.
 *
 * Rules:
 *  - Tests select on these ids, a URL, or a network response. Never on a CSS
 *    class (the stylesheet is being replaced) and never on visible copy (the
 *    app is bilingual EN/VI and all of it is being rewritten).
 *  - Definition-of-done for any rewritten screen: every id below still resolves
 *    to exactly one element.
 *  - Renaming an id requires updating tests/e2e in the same commit.
 *  - Add an id when a flow needs it; do not sprinkle them speculatively.
 */
export const TID = {
  // ── Chrome ────────────────────────────────────────────────────────────
  /** Top navigation bar. Named for the redesign's header, not today's sidebar. */
  navHeader: 'nav-header',
  navProfileLink: 'nav-profile-link',
  /** Hamburger button. Mobile only — the header collapses below `md`. */
  navMobileToggle: 'nav-mobile-toggle',
  /** Full-screen sheet the hamburger opens. Absent from the DOM when closed. */
  navMobileSheet: 'nav-mobile-sheet',

  /**
   * The home hero's dot globe. Decorative, so nothing asserts on it — this
   * exists so the visual baselines can MASK it. It rotates continuously and
   * lights dots at random, which is a full-page screenshot's worst case: no two
   * frames of it are ever the same.
   */
  heroGlobe: 'hero-globe',

  // ── Auth ──────────────────────────────────────────────────────────────
  authEmailInput: 'auth-email',
  authPasswordInput: 'auth-password',
  authSubmit: 'auth-submit',

  // ── Universities ──────────────────────────────────────────────────────
  uniSearchInput: 'uni-search-input',
  uniResultsGrid: 'uni-results-grid',
  uniCard: 'uni-card',
  uniCardSaveButton: 'uni-card-save',
  uniDetailPanel: 'uni-detail-panel',
  /** Server-side pagination control (3x3 grid in the new design). */
  uniPagination: 'uni-pagination',

  // ── Shortlist ─────────────────────────────────────────────────────────
  shortlistTab: 'shortlist-tab',
  shortlistCount: 'shortlist-count',

  // ── Scholarships ──────────────────────────────────────────────────────
  scholarshipList: 'scholarship-list',
  scholarshipCard: 'scholarship-card',

  // ── Onboarding ────────────────────────────────────────────────────────
  onboardingStep: 'onboarding-step',

  // ── Apply / AI strategy ───────────────────────────────────────────────
  /** Caption under a ScoreRing. Names which measure the ring shows. */
  scoreRingLabel: 'score-ring-label',
  /** The five-step journey nav. Both journeys use the same component. */
  stepper: 'stepper',

  // ── Feedback ──────────────────────────────────────────────────────────
  toast: 'app-toast',
  /**
   * The globe loading card. Present whenever the app is busy — a route
   * transition, a save, a submission — so E2E can wait it out instead of
   * racing it. Note it is NOT unique: the global overlay and a route-level
   * `loading.tsx` can both be mounted for a moment during a hard navigation.
   */
  globalLoader: 'global-loader',
} as const;

export type TestId = (typeof TID)[keyof typeof TID];

/**
 * Spread onto an element to attach a test id:
 *   <div {...testId(TID.uniCard)} />
 *
 * Preferred over writing `data-testid` by hand so the ids stay greppable and
 * typo-proof.
 */
export function testId(id: TestId): { 'data-testid': TestId } {
  return { 'data-testid': id };
}
