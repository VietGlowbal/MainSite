import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sourcesForSlugMock } = vi.hoisted(() => ({
  sourcesForSlugMock: vi.fn((slug: string): Array<{ sourceType: string }> => []),
}));

vi.mock('./lib', () => ({
  paths: { qualityDir: 'quality-checks' },
  readConfig: () => ({ requireSourcesForPublishable: true, requireHumanReview: false }),
  readManifest: () => [],
  readMarkdown: (value: string) => value,
  ensureDir: () => undefined,
  writeJsonFile: () => undefined,
  listExistingPageSlugs: () => [],
  cosineLikeSimilarity: () => 0,
  parseFrontmatter: (markdown: string) => {
    const text = markdown.replace(/\r\n/g, '\n');
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: text };
    const frontmatter: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx !== -1) frontmatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return { frontmatter, body: match[2] };
  },
  sourcesForSlug: (slug: string) => sourcesForSlugMock(slug),
}));

// Importing the module must NOT run its pipeline side effects (ensureDir +
// manifest evaluation) — those only run under direct CLI invocation.
import { evaluate } from './qualityCheck';

const PUBLISHABLE_MARKDOWN = [
  '---',
  'title: UK cost guide',
  'slug: uk-cost-guide',
  'description: Tuition and living costs for Vietnamese students.',
  'studentSegment: vietnamese-undergraduate',
  '---',
  '',
  '# UK cost guide',
  '',
  '## Short answer',
  '',
  'Budget carefully and verify official fees.',
  '',
  "## How Glowbal compares these options",
  '',
  'We compare published fees.',
  '',
  '## FAQs',
  '',
  '**Q?** A.',
  '',
  '## Sources',
  '',
  '- [Official fees](https://example.com)',
].join('\n');

describe('geo quality pipeline integration with the shared publication validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sourcesForSlugMock.mockImplementation((slug: string) =>
      slug === 'uk-cost-guide' ? [{ sourceType: 'official-university' }] : [],
    );
  });

  it('keeps a complete article publishable', () => {
    const result = evaluate('uk-cost-guide', PUBLISHABLE_MARKDOWN);

    expect(result.publishable).toBe(true);
    expect(result.blockerReasons).toEqual([]);
  });

  it('surfaces TODO_SOURCE_REQUIRED markers as blockers from the shared validator', () => {
    const result = evaluate('other-slug', `${PUBLISHABLE_MARKDOWN}\n- TODO_SOURCE_REQUIRED: fee page`);

    expect(result.blockerReasons.some((reason) => reason.includes('TODO_SOURCE_REQUIRED'))).toBe(true);
    expect(result.publishable).toBe(false);
    expect(result.reviewStatus).not.toBe('publishable');
  });

  it('surfaces generator draft descriptions as blockers', () => {
    const markdown = PUBLISHABLE_MARKDOWN.replace(
      'description: Tuition and living costs for Vietnamese students.',
      'description: A Glowbal draft guide for vietnamese applicants',
    );
    const result = evaluate('uk-cost-guide', markdown);

    expect(result.blockerReasons.join('\n')).toMatch(/[Dd]raft guide|placeholder/i);
    expect(result.publishable).toBe(false);
  });

  it('blocks specific cost numbers that have no verified official source', () => {
    sourcesForSlugMock.mockReturnValue([]);
    const markdown = `${PUBLISHABLE_MARKDOWN}\nAnnual tuition is £24,000 for international students.\n`;
    const result = evaluate('uk-cost-guide', markdown);

    expect(result.blockerReasons.join('\n')).toMatch(/tuition or cost numbers|verified official source/i);
    expect(result.publishable).toBe(false);
  });
});
