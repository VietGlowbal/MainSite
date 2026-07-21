import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Feature-Sliced Design boundaries.
 *
 * Expressed with the built-in `no-restricted-imports` rather than
 * eslint-plugin-import / eslint-plugin-boundaries: both need resolver config to
 * understand the `@/*` alias, and `import/no-restricted-paths` is the slowest
 * rule in the ecosystem. Pattern groups cost nothing and need no plugin.
 *
 * IMPORTANT — flat config does not merge rule options. When two blocks both set
 * `no-restricted-imports`, the last one matching a file REPLACES the earlier
 * one; the earlier patterns are silently lost. So the blocks below are written
 * as mutually exclusive zones, and each zone carries the full union of patterns
 * that apply to it. Adding a new block that sets this rule means checking it
 * cannot overlap an existing zone.
 *
 * On the day these land, src/{features,shared,server} do not exist, so the
 * feature/shared zones match nothing and `npm run lint` stays green.
 */
const FEATURES = ['universities', 'scholarships', 'apply', 'onboarding', 'mentorship', 'auth'];

const TEST_FILES = ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'];

/**
 * Debt registry: page components that still construct the RLS-bypassing
 * service-role client directly. This list may SHRINK, never grow — a new
 * offender is a lint failure. Track A's fix is deleting entries from here.
 */
const ADMIN_CLIENT_DEBT = [
  'src/app/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/plus/success/page.tsx',
  'src/app/universities/vinuni/page.tsx',
  // Removed: src/app/universities/page.tsx — now goes through the universities
  // repository (src/features/universities/api) instead of building an admin
  // client inline. This is what shrinking the list looks like.
];

/** Route handlers are server-side by definition — /api and the two outside it. */
const ROUTE_HANDLERS = ['src/app/**/route.ts'];

// ── Reusable restricted-import patterns ───────────────────────────────────
const NO_SERVER_DB = {
  group: ['@/server/db', '@/server/db/*', '@/server/db/**'],
  message:
    'Pages and routes must go through a feature repository (src/features/*/api), not src/server/db.',
};

const NO_FEATURE_API_FROM_UI = {
  group: ['@/features/*/api', '@/features/*/api/**', '../api', '../api/**', './api', './api/**'],
  message:
    'UI receives data via props or features/*/hooks. Never call a repository from a UI component.',
};

const NO_DEEP_FEATURE_IMPORT = {
  group: ['@/features/*/*/*'],
  message:
    'Import a feature through its barrel: @/features/<domain> or @/features/<domain>/<slice>.',
};

const SHARED_IS_A_LEAF = {
  group: ['@/features/**', '@/app/**', '@/server/**'],
  message: 'shared/* must not depend on features, app, or server.',
};

const NO_ADMIN_CLIENT = {
  group: ['@/server/db/admin', '@/lib/supabase/admin'],
  message:
    'createAdminClient bypasses RLS. Use it only in src/server, an API route, or a repository.',
};

/** features/<f> must not import any sibling feature. */
const noCrossFeature = (self) =>
  FEATURES.filter((other) => other !== self).map((other) => ({
    group: [`@/features/${other}`, `@/features/${other}/*`, `@/features/${other}/**`],
    message: `features/${self} must not import features/${other}. Lift shared code into src/shared or src/server.`,
  }));

const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // The GEO pipeline generates and commits code from here on a daily cron.
    // It has its own gate (`npm run geo:check` runs tsc against geo.tsconfig).
    'scripts/**',
  ]),

  // ── Zone: app/ — route handlers and the admin-client debt list ──────────
  // These may legitimately use the service-role client.
  {
    files: [...ROUTE_HANDLERS, ...ADMIN_CLIENT_DEBT],
    rules: restrict([NO_SERVER_DB, NO_DEEP_FEATURE_IMPORT]),
  },

  // ── Zone: app/ — everything else ────────────────────────────────────────
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: [...ROUTE_HANDLERS, ...ADMIN_CLIENT_DEBT, ...TEST_FILES],
    rules: restrict([NO_SERVER_DB, NO_DEEP_FEATURE_IMPORT, NO_ADMIN_CLIENT]),
  },

  // ── Zone: features/<f>/ ─────────────────────────────────────────────────
  ...FEATURES.flatMap((f) => [
    // api/ is the repository layer — it is the one place a feature may reach
    // the database directly.
    {
      files: [`src/features/${f}/api/**/*.{ts,tsx}`],
      rules: restrict([...noCrossFeature(f), NO_DEEP_FEATURE_IMPORT]),
    },
    // ui/ additionally may not reach into any api/.
    {
      files: [`src/features/${f}/ui/**/*.{ts,tsx}`],
      rules: restrict([
        NO_FEATURE_API_FROM_UI,
        ...noCrossFeature(f),
        NO_DEEP_FEATURE_IMPORT,
        NO_ADMIN_CLIENT,
      ]),
    },
    // domain/ and hooks/.
    {
      files: [`src/features/${f}/**/*.{ts,tsx}`],
      ignores: [`src/features/${f}/api/**`, `src/features/${f}/ui/**`],
      rules: restrict([...noCrossFeature(f), NO_DEEP_FEATURE_IMPORT, NO_ADMIN_CLIENT]),
    },
  ]),

  // ── Zone: shared/ — a leaf, depends on nothing above it ─────────────────
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: restrict([SHARED_IS_A_LEAF, NO_DEEP_FEATURE_IMPORT]),
  },

  // ── Zone: components/ — legacy UI, still must not touch the admin client ─
  {
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: TEST_FILES,
    rules: restrict([NO_ADMIN_CLIENT, NO_DEEP_FEATURE_IMPORT]),
  },

  // ── No raw colour literals in NEW UI code ───────────────────────────────
  // Zero violations today because these directories are empty; every file the
  // redesign adds is token-clean by construction. Deliberately NOT applied to
  // src/app or src/components — those are being replaced, and migrating their
  // 789 arbitrary values now would be thrown away twice.
  {
    files: ['src/features/**/*.tsx', 'src/shared/ui/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'Use a design token (bg-primary, text-secondary, var(--gb-*)) — no raw hex in features/shared UI.',
        },
      ],
    },
  },

  // ── Test files ──────────────────────────────────────────────────────────
  // Mocks legitimately need `any` (partial Supabase query-builder shapes,
  // vi.fn() returns) and `require()` (lazy re-import after vi.resetModules).
  // Enforcing these in test code buys nothing and pushes authors toward worse
  // workarounds. Production code keeps both rules as errors.
  {
    files: TEST_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);

export default eslintConfig;
