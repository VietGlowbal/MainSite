import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Ratchet, not a target. Set just under the numbers measured when the
      // thresholds were introduced (stmts 62.63 / branch 58.19 / funcs 56.72 /
      // lines 63.02), leaving a little slack so unrelated churn does not fail
      // CI. Raise them as coverage grows; treat any PR that lowers them as
      // review-blocking. A hard target is meaningless while the suite covers
      // essentially one vertical.
      //
      // Note: this measures files the tests actually load, not the whole repo.
      thresholds: {
        lines: 60,
        functions: 54,
        branches: 55,
        statements: 60,
      },
    },
    // Split by environment. API-route and pure-logic tests were paying the
    // cost of a jsdom window they never touch; only component tests need one.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/lib/**/*.test.ts',
            'src/app/api/**/*.test.ts',
            'src/features/**/domain/**/*.test.ts',
            'src/features/**/api/**/*.test.ts',
            // Pure logic in shared/ — the route registry, pagination. The `dom`
            // project already picks up `src/shared/**/*.test.tsx` for component
            // tests; this is the .ts half, which needs no window and was
            // previously matched by neither project (so a test file there ran
            // nowhere and silently counted as passing).
            'src/shared/**/*.test.ts',
            'src/server/**/*.test.ts',
            'src/__tests__/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./src/__tests__/setup.ts'],
          include: [
            'src/app/**/*.test.tsx',
            'src/components/**/*.test.tsx',
            'src/features/**/ui/**/*.test.tsx',
            'src/features/**/hooks/**/*.test.tsx',
            'src/shared/**/*.test.tsx',
          ],
        },
      },
    ],
  },
});
