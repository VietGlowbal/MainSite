import { describe, expect, it } from 'vitest';
import type { Recommendation } from './recommendation';
import { SEEDED_CATEGORIES } from './strategy-category';
import {
  STRATEGY_TOOLS,
  recommendationHelp,
  strategyToolHref,
  toolForRecommendation,
} from './strategy-tool';

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec-1',
    applicationId: 'app-1',
    category: null,
    pillar: null,
    title: 'Do the thing',
    reason: null,
    priority: 'medium',
    status: 'not_started',
    estimatedImpact: null,
    estimatedEffort: null,
    deadline: null,
    evidenceRequired: false,
    relatedRequirement: null,
    actionLabel: null,
    actionType: null,
    actionTarget: null,
    confidence: 0,
    isDismissed: false,
    sourceAnalysisId: null,
    archivedAt: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('strategyToolHref', () => {
  /**
   * The CV flow has no index route. Entering anywhere other than step 1 bounces
   * a student who has no target profile yet, so this asserting the exact step
   * is the point, not incidental.
   */
  it('enters the CV builder at step 1', () => {
    expect(strategyToolHref('cv', 'app-1')).toBe('/ai-strategy/app-1/cv/target-profile');
  });

  it('points at the statement writer', () => {
    expect(strategyToolHref('statement', 'app-1')).toBe('/ai-strategy/app-1/statement');
  });
});

describe('toolForRecommendation', () => {
  it('offers the statement writer for the essays pillar', () => {
    expect(toolForRecommendation(rec({ pillar: 'essays' }))).toBe('statement');
  });

  it('offers it by category too, for a row with no pillar', () => {
    expect(toolForRecommendation(rec({ category: 'personal-statement' }))).toBe('statement');
  });

  it('offers nothing for the other pillars', () => {
    for (const pillar of ['academic', 'activities', 'impact', 'personal'] as const) {
      expect(toolForRecommendation(rec({ pillar })), pillar).toBeNull();
    }
  });

  /**
   * Guards the decision in the module header: matching on wording was the
   * rejected alternative, because it fires on tasks that are not about the
   * statement at all.
   */
  it('does not match on the title text', () => {
    expect(
      toolForRecommendation(rec({ pillar: 'activities', title: 'Write up your robotics project' })),
    ).toBeNull();
  });
});

describe('recommendationHelp', () => {
  it('prefers a first-party tool over an AI-supplied link', () => {
    const help = recommendationHelp(
      rec({
        pillar: 'essays',
        actionType: 'external_url',
        actionTarget: 'https://example.com/essay-tips',
        actionLabel: 'Read essay tips',
      }),
      'app-1',
    );
    expect(help).toEqual({
      href: '/ai-strategy/app-1/statement',
      label: STRATEGY_TOOLS.statement.label,
      external: false,
    });
  });

  it('falls back to an external link when no tool applies', () => {
    const help = recommendationHelp(
      rec({
        pillar: 'academic',
        actionType: 'external_url',
        actionTarget: 'https://example.com/maths',
        actionLabel: 'Course page',
      }),
      'app-1',
    );
    expect(help).toEqual({
      href: 'https://example.com/maths',
      label: 'Course page',
      external: true,
    });
  });

  it('labels an unlabelled link rather than rendering an empty one', () => {
    expect(
      recommendationHelp(
        rec({ actionType: 'external_url', actionTarget: 'https://example.com' }),
        'app-1',
      )?.label,
    ).toBe('View');
  });

  it('returns null when there is no tool and no target', () => {
    expect(recommendationHelp(rec({ actionType: 'none' }), 'app-1')).toBeNull();
    expect(recommendationHelp(rec({ actionType: 'upload_document' }), 'app-1')).toBeNull();
  });

  it('ignores a blank or whitespace-only target', () => {
    expect(
      recommendationHelp(rec({ actionType: 'external_url', actionTarget: '   ' }), 'app-1'),
    ).toBeNull();
  });

  /**
   * `actionTarget` is a string from a language model that ends up in an href.
   * These are the cases where getting it wrong is a security bug rather than a
   * broken link.
   */
  describe('untrusted AI-supplied targets', () => {
    it('rejects a javascript: target', () => {
      expect(
        recommendationHelp(
          rec({ actionType: 'external_url', actionTarget: 'javascript:alert(1)' }),
          'app-1',
        ),
      ).toBeNull();
    });

    it('rejects a data: target', () => {
      expect(
        recommendationHelp(
          rec({ actionType: 'external_url', actionTarget: 'data:text/html,<script>' }),
          'app-1',
        ),
      ).toBeNull();
    });

    it('rejects an internal_route that is actually an absolute URL elsewhere', () => {
      expect(
        recommendationHelp(
          rec({ actionType: 'internal_route', actionTarget: 'https://evil.example/phish' }),
          'app-1',
        ),
      ).toBeNull();
    });

    it('accepts a genuine site-relative internal route', () => {
      expect(
        recommendationHelp(
          rec({ actionType: 'internal_route', actionTarget: '/scholarships', actionLabel: 'Browse' }),
          'app-1',
        ),
      ).toEqual({ href: '/scholarships', label: 'Browse', external: false });
    });
  });
});

describe('SEEDED_CATEGORIES', () => {
  /**
   * The bug this replaced: CV / Portfolio was flagged `comingSoon` while the
   * builder was live, and it can never earn a place on the board by task count
   * because nothing assigns it a category. Its tool binding is the only reason
   * it renders at all.
   */
  it('binds CV / Portfolio to the CV builder', () => {
    const cv = SEEDED_CATEGORIES.find((c) => c.key === 'cv-portfolio');
    expect(cv?.tool).toBe('cv');
  });

  it('binds Personal Statement to the writer while keeping its pillar', () => {
    const statement = SEEDED_CATEGORIES.find((c) => c.key === 'personal-statement');
    expect(statement?.tool).toBe('statement');
    expect(statement?.pillar).toBe('essays');
  });

  it('every tool binding names a real tool', () => {
    for (const category of SEEDED_CATEGORIES) {
      if (category.tool === null) continue;
      expect(STRATEGY_TOOLS[category.tool], category.key).toBeDefined();
    }
  });
});
