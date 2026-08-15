import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  STATUS_SELECT_CLASS,
  STATUS_VARIANT,
  categoryLabel,
  categoryVariant,
  formatDate,
} from './planner-presentation';

const UI_DIR = path.join(process.cwd(), 'src/features/ai-strategy-dashboard/ui');
const read = (file: string) => readFileSync(path.join(UI_DIR, file), 'utf8');

/**
 * The guard for the bug in `docs/known-issues.md §5l`.
 *
 * These mappings used to live in `planner-shared.tsx`, which is `'use client'`.
 * The task detail page and `dashboard-summary.tsx` are server components, and
 * a `'use client'` module's exports reach a server component as client
 * references, not values — calling one throws, reading one yields `undefined`.
 * Every task detail page 500'd as a result.
 *
 * A unit test cannot reproduce the RSC boundary (vitest has one module graph),
 * so these assert the structural property that prevents it instead: the module
 * holding the shared mappings must stay directive-free, and the server-side
 * consumers must not reach for the client module to get them.
 */
describe('planner presentation module stays server-safe', () => {
  it('does not declare "use client"', () => {
    // A directive is a statement on its own line. Matching the bare string
    // would also hit the file's own header comment, which names the directive
    // precisely to warn against adding it.
    const directive = /^\s*['"]use client['"]\s*;?\s*$/m;
    expect(read('planner-presentation.ts')).not.toMatch(directive);
    // Sanity check that the pattern does detect a real directive, so this
    // test cannot quietly pass because the regex stopped matching anything.
    expect(read('planner-shared.tsx')).toMatch(directive);
  });

  it('exports the mappings the server-rendered surfaces import', () => {
    // The barrel is what the task detail page imports from; if these ever get
    // re-pointed at `planner-shared`, the page breaks again.
    expect(read('index.ts')).toMatch(/from '\.\/planner-presentation'/);
    expect(read('index.ts')).not.toMatch(
      /export\s*\{[^}]*\b(categoryLabel|categoryVariant|formatDate|PRIORITY_\w+)\b[^}]*\}\s*from '\.\/planner-shared'/s,
    );
  });

  it('keeps dashboard-summary (a server component) off the client module for formatDate', () => {
    const source = read('dashboard-summary.tsx');
    expect(source).toMatch(/import \{ formatDate \} from '\.\/planner-presentation'/);
    expect(source).not.toMatch(/import \{[^}]*\bformatDate\b[^}]*\} from '\.\/planner-shared'/);
  });
});

describe('planner presentation mappings', () => {
  it('maps every priority to a variant and a label', () => {
    for (const priority of ['urgent', 'high', 'medium', 'low'] as const) {
      expect(PRIORITY_VARIANT[priority]).toBeTruthy();
      expect(PRIORITY_LABEL[priority]).toBeTruthy();
    }
  });

  it('maps every status to a variant and a select class', () => {
    for (const status of [
      'not_started',
      'in_progress',
      'completed',
      'needs_review',
      'blocked',
    ] as const) {
      expect(STATUS_VARIANT[status]).toBeTruthy();
      expect(STATUS_SELECT_CLASS[status]).toBeTruthy();
    }
  });

  it('falls back to a neutral pill and the raw key for an unknown category', () => {
    expect(categoryVariant('not-a-real-category')).toBe('neutral-chip');
    expect(categoryLabel('not-a-real-category')).toBe('not-a-real-category');
  });

  it('reads a null category as General, not as a missing label', () => {
    expect(categoryVariant(null)).toBe('neutral-chip');
    expect(categoryLabel(null)).toBe('General');
  });

  it('formats a date in UTC and degrades on a null or unparseable value', () => {
    expect(formatDate('2026-08-14')).toBe('14 Aug 2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });
});
