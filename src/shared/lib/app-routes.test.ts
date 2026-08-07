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
  it('links everything once the analysis and planner are ready', () => {
    const items = applicationSubNav('app_1', { analysisReady: true, plannerReady: true });
    expect(items.every((item) => !item.locked)).toBe(true);
    expect(items.map((item) => item.key)).toEqual([
      'overview',
      'portrait',
      'fit',
      'planner',
      'cv',
      'statement',
    ]);
    expect(items.find((item) => item.key === 'cv')?.href).toBe('/apply/app_1/cv');
    expect(items.find((item) => item.key === 'statement')?.href).toBe(
      '/apply/app_1/statement-feedback',
    );
  });

  it('shows the planner locked rather than hiding it', () => {
    // Hiding would make the product look smaller and tell the student nothing
    // about what finishing unlocks.
    const items = applicationSubNav('app_1', { analysisReady: false, plannerReady: false });
    expect(items.find((i) => i.key === 'planner')?.locked).toBe(true);
    expect(items.find((i) => i.key === 'portrait')?.locked).toBe(true);
    // The tools never lock — they do not depend on the analysis.
    expect(items.find((i) => i.key === 'cv')?.locked).toBeUndefined();
    expect(items.find((i) => i.key === 'overview')?.locked).toBeUndefined();
  });
});

describe('activeSubNavKey', () => {
  it('does not collapse the reports into the planner', () => {
    // Both live under /strategy; longest-match-first is what separates them.
    expect(activeSubNavKey('/ai-strategy/a/strategy/analysis/fit')).toBe('fit');
    expect(activeSubNavKey('/ai-strategy/a/strategy/analysis/portrait')).toBe('portrait');
    expect(activeSubNavKey('/ai-strategy/a/strategy/dashboard')).toBe('planner');
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
});

describe('applicationIdFromPath', () => {
  it('reads the id from both subtrees', () => {
    expect(applicationIdFromPath('/apply/app_1')).toBe('app_1');
    expect(applicationIdFromPath('/ai-strategy/app_1/strategy/dashboard')).toBe('app_1');
  });

  it('does not mistake /ai-strategy/reflection for an application', () => {
    expect(applicationIdFromPath('/ai-strategy/reflection/achievements')).toBeNull();
  });

  it('returns null where there is no application', () => {
    expect(applicationIdFromPath('/apply')).toBeNull();
    expect(applicationIdFromPath('/universities/12')).toBeNull();
  });
});
