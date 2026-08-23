import { describe, expect, it } from 'vitest';
import {
  activeSubNavKey,
  applicationIdFromPath,
  applicationSubNav,
  breadcrumbTrail,
  matchRoute,
} from './app-routes';

describe('matchRoute', () => {
  it('captures params', () => {
    expect(matchRoute('/apply/:id', '/apply/app_123')).toEqual({ id: 'app_123' });
  });

  it('rejects a different depth', () => {
    expect(matchRoute('/apply/:id', '/apply')).toBeNull();
    expect(matchRoute('/apply/:id', '/apply/a/b')).toBeNull();
  });

  it('rejects a different literal', () => {
    expect(matchRoute('/apply/:id', '/news/app_123')).toBeNull();
  });
});

describe('breadcrumbTrail', () => {
  it('builds a trail whose parents are not URL prefixes', () => {
    // The point of the registry: "My Portal" is /apply, which shares no prefix
    // with an /ai-strategy pathname. Chopping the URL would 404 here.
    const trail = breadcrumbTrail('/ai-strategy/app_1/strategy/analysis/portrait');
    expect(trail).toEqual([
      { label: 'My Portal', href: '/apply' },
      { label: 'Your application', href: '/apply/app_1' },
      { label: 'Personal Report' },
    ]);
  });

  it('never links the last crumb', () => {
    for (const path of [
      '/apply',
      '/apply/app_1',
      '/ai-strategy/app_1/strategy/dashboard',
      '/advisors/apply/success',
    ]) {
      const trail = breadcrumbTrail(path);
      expect(trail.at(-1)?.href).toBeUndefined();
    }
  });

  it('substitutes a real name for a dynamic crumb', () => {
    const trail = breadcrumbTrail('/ai-strategy/app_1/strategy/dashboard', {
      application: 'MSc Health Administration',
    });
    expect(trail[1]).toEqual({ label: 'MSc Health Administration', href: '/apply/app_1' });
  });

  it('falls back to an honest generic label without one', () => {
    const trail = breadcrumbTrail('/ai-strategy/app_1/strategy/dashboard');
    expect(trail[1]?.label).toBe('Your application');
  });

  it('returns nothing for routes with no way back', () => {
    // Not a failure — a trail out of /auth or /onboarding would be unhelpful.
    expect(breadcrumbTrail('/auth')).toEqual([]);
    expect(breadcrumbTrail('/onboarding')).toEqual([]);
    expect(breadcrumbTrail('/')).toEqual([]);
  });

  it('ignores query strings and trailing slashes', () => {
    expect(breadcrumbTrail('/apply/app_1/')).toEqual(breadcrumbTrail('/apply/app_1'));
    expect(breadcrumbTrail('/ai-strategy/app_1/strategy/dashboard?view=calendar')).toEqual(
      breadcrumbTrail('/ai-strategy/app_1/strategy/dashboard'),
    );
  });

  it('prefers the more specific pattern', () => {
    // /ai-strategy/reflection/achievements must not match /ai-strategy/:id/...
    expect(breadcrumbTrail('/ai-strategy/reflection/achievements').at(-1)?.label).toBe(
      'Achievements',
    );
    expect(breadcrumbTrail('/advisors/apply').at(-1)?.label).toBe('Become an advisor');
  });

  it('routes a task detail back through the planner', () => {
    const trail = breadcrumbTrail('/ai-strategy/app_1/strategy/recommendations/rec_9');
    expect(trail.map((c) => c.href)).toEqual([
      '/apply',
      '/apply/app_1',
      '/ai-strategy/app_1/strategy/dashboard',
      undefined,
    ]);
  });
});

describe('applicationSubNav', () => {
  it('links everything once the analysis, strategy and planner are ready, swapping Overview for Reflections', () => {
    const items = applicationSubNav('app_1', {
      analysisReady: true,
      strategyReady: true,
      plannerReady: true,
      candidateConfirmed: true,
    });
    expect(items.every((item) => !item.locked)).toBe(true);
    expect(items.map((item) => item.key)).toEqual([
      'reflections',
      'portrait',
      'fit',
      'strategyReport',
      'planner',
      'cv',
      'statement',
    ]);
    expect(items.find((item) => item.key === 'reflections')?.href).toBe(
      '/ai-strategy/reflection/confirm?return=%2Fai-strategy%2Fapp_1%2Fstrategy%2Fanalysis',
    );
    expect(items.find((item) => item.key === 'strategyReport')?.href).toBe(
      '/ai-strategy/app_1/strategy/analysis/recommendation',
    );
    expect(items.find((item) => item.key === 'cv')?.href).toBe('/apply/app_1/cv');
    expect(items.find((item) => item.key === 'statement')?.href).toBe(
      '/apply/app_1/statement-feedback',
    );
  });

  it('marks the planner and strategy report locked when not yet reachable, and shows Overview instead of Reflections', () => {
    // SubNav (src/shared/ui/sub-nav.tsx) is what decides whether a locked
    // entry renders at all — this list just has to keep marking them.
    const items = applicationSubNav('app_1', {
      analysisReady: false,
      strategyReady: false,
      plannerReady: false,
      candidateConfirmed: false,
    });
    expect(items.find((i) => i.key === 'planner')?.locked).toBe(true);
    expect(items.find((i) => i.key === 'strategyReport')?.locked).toBe(true);
    expect(items.find((i) => i.key === 'portrait')?.locked).toBe(true);
    // The tools never lock — they do not depend on the analysis.
    expect(items.find((i) => i.key === 'cv')?.locked).toBeUndefined();
    expect(items.find((i) => i.key === 'overview')?.locked).toBeUndefined();
    expect(items.find((i) => i.key === 'reflections')).toBeUndefined();
  });

  it('locks Reflections if analysis is somehow ready before candidate confirmation', () => {
    const items = applicationSubNav('app_1', {
      analysisReady: true,
      strategyReady: false,
      plannerReady: false,
      candidateConfirmed: false,
    });
    expect(items.find((i) => i.key === 'reflections')?.locked).toBe(true);
    expect(items.find((i) => i.key === 'overview')).toBeUndefined();
  });
});

describe('activeSubNavKey', () => {
  it('does not collapse the reports into the planner', () => {
    // Both live under /strategy; longest-match-first is what separates them.
    expect(activeSubNavKey('/ai-strategy/a/strategy/analysis/fit')).toBe('fit');
    expect(activeSubNavKey('/ai-strategy/a/strategy/analysis/portrait')).toBe('portrait');
    expect(activeSubNavKey('/ai-strategy/a/strategy/analysis/recommendation')).toBe(
      'strategyReport',
    );
    expect(activeSubNavKey('/ai-strategy/a/strategy/dashboard')).toBe('planner');
  });

  it('treats StrategyHome and the intro explainer as pre-Planner onboarding, not the Planner', () => {
    // These used to alias to 'planner' back when /strategy/intro was the
    // last step before the dashboard. Now the Personalized Strategy report
    // sits between them and the Planner, so neither should highlight it.
    expect(activeSubNavKey('/ai-strategy/a/strategy')).toBe('overview');
    expect(activeSubNavKey('/ai-strategy/a/strategy/intro')).toBe('overview');
  });

  it('keeps a task detail under the planner', () => {
    expect(activeSubNavKey('/ai-strategy/a/strategy/recommendations/r1')).toBe('planner');
  });

  it('resolves the tools and the workspace', () => {
    expect(activeSubNavKey('/ai-strategy/a/cv/target-profile')).toBe('cv');
    expect(activeSubNavKey('/ai-strategy/a/statement')).toBe('statement');
    expect(activeSubNavKey('/apply/a/cv')).toBe('cv');
    expect(activeSubNavKey('/apply/a/cv-builder')).toBe('cv');
    expect(activeSubNavKey('/apply/a/cv-review')).toBe('cv');
    expect(activeSubNavKey('/apply/a/statement-feedback')).toBe('statement');
    expect(activeSubNavKey('/apply/app_1')).toBe('overview');
  });

  it('returns null off the application journey', () => {
    expect(activeSubNavKey('/apply')).toBeNull();
    expect(activeSubNavKey('/universities')).toBeNull();
  });

  it('highlights Reflections for all three Candidate Information pages', () => {
    expect(activeSubNavKey('/ai-strategy/reflection')).toBe('reflections');
    expect(activeSubNavKey('/ai-strategy/reflection/achievements')).toBe('reflections');
    expect(activeSubNavKey('/ai-strategy/reflection/confirm?return=%2Fai-strategy%2Fa')).toBe(
      'reflections',
    );
  });
});

describe('applicationIdFromPath', () => {
  const testCases: Array<{ name: string; input: string; expected: string | null }> = [
    { name: 'plain apply URL', input: '/apply/app_1', expected: 'app_1' },
    {
      name: 'plain strategy URL',
      input: '/ai-strategy/app_1/strategy/dashboard',
      expected: 'app_1',
    },
    { name: 'plain strategy root URL', input: '/ai-strategy/app_1', expected: 'app_1' },
    {
      name: 'URL-encoded return URL',
      input: '/ai-strategy/reflection?return=%2Fai-strategy%2Fapp_xyz%2Fstrategy%2Fanalysis',
      expected: 'app_xyz',
    },
    {
      name: 'nested return URL (plain)',
      input:
        '/profile/academic?return=/ai-strategy/reflection?return=/ai-strategy/app_deep/strategy/analysis',
      expected: 'app_deep',
    },
    {
      name: 'nested return URL (double encoded)',
      input:
        '/profile/academic?return=%2Fai-strategy%2Freflection%3Freturn%3D%252Fai-strategy%252Fapp_deep%252Fstrategy%252Fanalysis',
      expected: 'app_deep',
    },
    {
      name: 'missing return param on non-application route',
      input: '/ai-strategy/reflection/achievements',
      expected: null,
    },
    {
      name: 'personal report canonical route without application return',
      input: '/ai-strategy/personal-report',
      expected: null,
    },
    {
      name: 'malformed encoding in query param',
      input: '/profile?return=%E0%A4%A',
      expected: null,
    },
    {
      name: 'external URL rejection (absolute scheme)',
      input: 'https://evil.com/apply/app_1',
      expected: null,
    },
    {
      name: 'external URL rejection (protocol relative)',
      input: '//evil.com/apply/app_1',
      expected: null,
    },
    {
      name: 'external URL rejection (backslash variant)',
      input: '/\\evil.com/apply/app_1',
      expected: null,
    },
    {
      name: 'external URL rejection in nested return parameter',
      input: '/profile?return=https://evil.com/apply/app_1',
      expected: null,
    },
    {
      name: 'external URL rejection in nested return parameter (protocol relative)',
      input: '/profile?return=//evil.com/apply/app_1',
      expected: null,
    },
    {
      name: 'javascript scheme rejection in return parameter',
      input: '/profile?return=javascript:alert(1)',
      expected: null,
    },
    {
      name: 'missing application id (apply root)',
      input: '/apply',
      expected: null,
    },
    {
      name: 'missing application id (discovery route)',
      input: '/universities/12',
      expected: null,
    },
    {
      name: 'missing application id (profile root)',
      input: '/profile',
      expected: null,
    },
  ];

  for (const tc of testCases) {
    it(`handles ${tc.name}`, () => {
      expect(applicationIdFromPath(tc.input)).toBe(tc.expected);
    });
  }
});
