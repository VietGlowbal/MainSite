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

  /**
   * The whole "Our featured partners" SECTION. Decorative, like `heroGlobe`,
   * and here for the same reason: the logos orbit continuously, so consecutive
   * frames are never identical and `toHaveScreenshot` cannot even reach the
   * comparison — it fails with "Failed to take two consecutive stable
   * screenshots". The globe was masked when it stopped being a static PNG; this
   * one was set orbiting in the same batch of work and was missed.
   *
   * ⚠️ ON THE SECTION, NOT THE ORBIT STAGE INSIDE IT, and that is not a
   * preference. Playwright masks by bounding box, and the logos orbit a curve
   * that runs OUTSIDE the stage's box (it is capped at `min(88%,1120px)`), so
   * masking the stage left a ring of moving tiles poking out on both sides and
   * the screenshot stayed unstable. Verified from the diff image.
   */
  heroPartners: 'hero-partners',

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
  /** Bounded hero frame on /universities/[id]; its child image uses `fill`. */
  uniDetailHero: 'uni-detail-hero',
  /** Server-side pagination control (3x3 grid in the new design). */
  uniPagination: 'uni-pagination',

  // ── Shortlist ─────────────────────────────────────────────────────────
  shortlistTab: 'shortlist-tab',
  shortlistCount: 'shortlist-count',

  // ── Scholarships ──────────────────────────────────────────────────────
  scholarshipList: 'scholarship-list',
  scholarshipCard: 'scholarship-card',
  scholarshipContinueToApply: 'scholarship-continue-to-apply',
  scholarshipUniversityPicker: 'scholarship-university-picker',
  scholarshipUniversityOption: 'scholarship-university-option',
  scholarshipUniversitySave: 'scholarship-university-save',

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
