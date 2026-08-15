import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production i18n checker', () => {
  it('runs the real checker and requires both translation directions to be covered', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'glowbal-i18n-check-'));
    const reportPath = path.join(tempDir, 'report.json');
    try {
      const output = execFileSync(
        process.execPath,
        ['scripts/check-i18n.mjs', '--all', '--output', reportPath],
        { cwd: process.cwd(), encoding: 'utf8' },
      );
      const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
        missing: unknown[];
        actionableViSource: unknown[];
        parity: unknown[];
        auditedObjectProperties: string[];
        dynamicTranslationCalls: unknown[];
        dynamicCatalogMissing: unknown[];
      };
      expect(output).toContain('missing static keys: 0');
      expect(output).toContain('actionable VI-only source: 0');
      expect(report.missing).toHaveLength(0);
      expect(report.actionableViSource).toHaveLength(0);
      expect(report.parity).toHaveLength(0);
      expect(report.auditedObjectProperties).toEqual(
        expect.arrayContaining([
          'body',
          'blurb',
          'definition',
          'description',
          'detail',
          'hint',
          'message',
          'section',
          'subtitle',
        ]),
      );
      expect(report.dynamicTranslationCalls.length).toBeGreaterThan(0);
      expect(report.dynamicCatalogMissing).toHaveLength(0);
    } finally {
      if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps the Vietnamese-source exemption to the two legal routes', () => {
    // `actionable VI-only source: 0` above is satisfiable two ways: by writing
    // English source, or by exempting the route. The exemption exists for
    // /privacy and /terms, whose Vietnamese wording is the legally operative
    // one — widening it to a product route would silence the check for that
    // whole screen, so make that a deliberate act rather than a quiet one.
    const script = readFileSync('scripts/check-i18n.mjs', 'utf8');
    const declared = /VI_AUTHORITATIVE_ROUTES = new Set\(\[([^\]]*)\]\)/.exec(script)?.[1] ?? '';
    const routes = [...declared.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(routes).toEqual(['/privacy', '/terms']);
  });
});
