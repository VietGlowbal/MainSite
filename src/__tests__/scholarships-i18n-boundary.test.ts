import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/scholarships i18n ownership', () => {
  it('keeps the legacy DOM translator out of its explicitly localized content', () => {
    const source = readFileSync(join(process.cwd(), 'src/app/scholarships/page.tsx'), 'utf8');

    expect(source).toContain('data-no-auto-translate');
  });
});
