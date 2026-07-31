import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The /ai-strategy route tree, asserted structurally.
 *
 * WHY THIS TEST EXISTS. Adding `[applicationId]` put a dynamic segment directly
 * beside the static `reflection` one. Next.js resolves static before dynamic, so
 * /ai-strategy/reflection still reaches the reflection page rather than being
 * captured as an application id — but that is a framework precedence rule, not
 * something visible in the file tree. If `reflection/` were ever moved, renamed
 * or nested, those two pages would start rendering the strategy layout, fail its
 * uuid check, and 404. Silently, for a flow that has no test of its own.
 *
 * So this asserts the shape rather than the behaviour: both kinds of segment
 * exist as siblings, and the reflection paths the step config publishes still
 * have pages behind them.
 */

const AI_STRATEGY = join(process.cwd(), 'src/app/ai-strategy');

describe('the /ai-strategy route tree', () => {
  it('has the dynamic application segment and the static reflection segment as siblings', () => {
    const entries = readdirSync(AI_STRATEGY, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    expect(entries).toContain('[applicationId]');
    expect(entries).toContain('reflection');
  });

  it('keeps a page behind every reflection path the step config publishes', () => {
    // Mirrors REFLECTION_STEPS in features/apply/domain/reflection-steps.ts. If
    // a step's `path` moves, this fails rather than the route quietly falling
    // through to [applicationId].
    const paths = ['/ai-strategy/reflection', '/ai-strategy/reflection/achievements'];

    for (const path of paths) {
      const segment = path.replace('/ai-strategy', '');
      const file = join(AI_STRATEGY, segment, 'page.tsx');
      expect(existsSync(file), `${path} should be served by ${file}`).toBe(true);
    }
  });

  it('gives the application subtree a layout so ownership is checked once', () => {
    // The six pages under here rely on the layout for the session and ownership
    // check. Without it each page would need its own, which is the arrangement
    // where the seventh page ships without one.
    expect(existsSync(join(AI_STRATEGY, '[applicationId]/layout.tsx'))).toBe(true);
    expect(existsSync(join(AI_STRATEGY, '[applicationId]/page.tsx'))).toBe(true);
  });

  it('does not put a layout at the /ai-strategy root', () => {
    // A root layout here would wrap the reflection pages too, and they carry
    // their own chrome via ReflectionChrome — two headers on one page is the
    // regression mobile-nav.spec.ts guards against.
    expect(existsSync(join(AI_STRATEGY, 'layout.tsx'))).toBe(false);
  });
});
