import type { Recommendation } from './recommendation';

/**
 * Strategy Tools — the workspaces a student can open to actually DO a
 * recommendation, rather than only read it.
 *
 * ─── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────
 *
 * Both tools were fully built and unreachable. The CV builder
 * (`/ai-strategy/[id]/cv/*`, four steps ending in a PDF export) was linked only
 * from `/demo-throwaway`, and the statement writer (`StatementWriter`) only from
 * the legacy `/my-universities/[id]` page. Meanwhile the Dashboard told students
 * their CV work was "Coming soon". A student reading "tighten your personal
 * statement" had no way to get from that sentence to the tool that does it.
 *
 * So the mapping lives here — one place that answers "which workspace finishes
 * this task", used by both the category board and the recommendation table, so
 * the two cannot disagree about where a tool lives.
 *
 * ─── WHY NOT JUST USE THE AI'S OWN actionTarget ──────────────────────────────
 *
 * `application_recommendations` already carries `action_type` / `action_target`,
 * and the table's "Help" column already rendered them. That is not enough on its
 * own, for two reasons:
 *
 *   1. The model does not know these routes exist. `actionTarget` comes from
 *      match-insights' improvement-action prompt, which is given the course and
 *      the student's profile — not a directory of GlowBal's internal URLs. In
 *      practice it emits `none` or an external link, so the Help column was
 *      usually a dash.
 *   2. Even when it does emit `internal_route`, it is a string from a language
 *      model being used as a URL. Resolving tools from the row's *pillar* — an
 *      enum the model must choose from — keeps a hallucinated path out of an
 *      href.
 *
 * So an AI-supplied `external_url` is still honoured (it is genuinely extra
 * information, e.g. a specific scholarship page), but the two first-party tools
 * are matched structurally instead.
 *
 * ─── THE MATCH IS ON PILLAR, NOT ON WORDING ──────────────────────────────────
 *
 * `pillar: 'essays'` is the whole basis for offering the statement writer.
 * Matching on the title text ("statement", "essay", "personal") was the
 * alternative and it is worse in both directions: it misses "Give your opening
 * paragraph a concrete anchor", and it fires on "Describe your robotics project"
 * — a text-similarity guess where an enum was already available.
 *
 * The CV tool is deliberately NOT pillar-matched. No pillar means "your CV",
 * because a CV is the artefact that carries academics, activities and impact all
 * at once; attaching it to any one pillar would be arbitrary. It is reachable as
 * a category-level workspace (see `STRATEGY_TOOLS` consumers) rather than as the
 * answer to one particular task.
 */

export type StrategyToolKey = 'cv' | 'statement';

export type StrategyTool = {
  key: StrategyToolKey;
  /** Button/link text. An imperative, because it opens a workspace. */
  label: string;
  /** One line on what the tool does, for the category card. */
  blurb: string;
};

export const STRATEGY_TOOLS: Record<StrategyToolKey, StrategyTool> = {
  cv: {
    key: 'cv',
    label: 'Open CV builder',
    blurb: 'Build a CV against what this course asks for, then export it as a PDF.',
  },
  statement: {
    key: 'statement',
    label: 'Open statement writer',
    blurb: 'Get line-by-line AI feedback on your personal statement or SOP.',
  },
};

/**
 * Where a tool lives for a given application.
 *
 * The CV tool enters at `target-profile` (step 1) rather than at a bare `/cv`
 * index, because there is no such index — the flow is
 * target-profile → content → layout → review, and every later step redirects
 * back to step 1 when there is no profile yet. Sending a student to step 3
 * would bounce them.
 */
export function strategyToolHref(
  tool: StrategyToolKey | 'personal_canvas' | 'cv_builder' | 'statement_writer',
  applicationId: string,
): string {
  switch (tool) {
    case 'cv':
    case 'cv_builder':
      return `/ai-strategy/${applicationId}/cv/target-profile`;
    case 'statement':
    case 'statement_writer':
      return `/ai-strategy/${applicationId}/statement`;
    case 'personal_canvas':
      return `/ai-strategy/personal-report?return=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy-report`)}`;
  }
}

/** An outbound link the AI attached to a recommendation, if it gave a usable one. */
export type RecommendationLink = {
  href: string;
  label: string;
  external: boolean;
};

/**
 * The tool that would finish this recommendation, or null.
 *
 * Only `essays` maps to a tool today — see the header on why the CV builder is
 * offered per-category rather than per-task, and why this is an enum match
 * rather than a keyword match on the title.
 */
export function toolForRecommendation(recommendation: Recommendation): StrategyToolKey | null {
  if (recommendation.pillar === 'essays') return 'statement';
  if (recommendation.category === 'personal-statement') return 'statement';
  return null;
}

/**
 * What the "Help" column should offer for a row: a first-party tool where one
 * applies, otherwise the AI's own link, otherwise nothing.
 *
 * A tool wins over an AI link because it is a workspace inside GlowBal that
 * writes back to this application, which is both more useful and the thing the
 * owner asked for — keeping students on the platform.
 *
 * `internal_route` targets are only honoured when they look like a site-relative
 * path. A model asked for a route can return a full URL to somewhere else
 * entirely, and `internal_route` is exactly the case where that must not become
 * an unmarked, same-tab link.
 */
export function recommendationHelp(
  recommendation: Recommendation,
  applicationId: string,
): RecommendationLink | null {
  const tool = toolForRecommendation(recommendation);
  if (tool) {
    return {
      href: strategyToolHref(tool, applicationId),
      label: STRATEGY_TOOLS[tool].label,
      external: false,
    };
  }

  const target = recommendation.actionTarget?.trim();
  if (!target) return null;
  const label = recommendation.actionLabel?.trim() || 'View';

  if (recommendation.actionType === 'external_url') {
    // Only http(s). A `javascript:` or `data:` target reaching an href is the
    // one failure here that is a security bug rather than a broken link.
    if (!/^https?:\/\//i.test(target)) return null;
    return { href: target, label, external: true };
  }

  if (recommendation.actionType === 'internal_route') {
    if (!target.startsWith('/')) return null;
    return { href: target, label, external: false };
  }

  return null;
}
