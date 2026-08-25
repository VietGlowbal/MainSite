import { describe, expect, it } from 'vitest';
import {
  hasPlaceholderPublicationQuality,
  listPublicationBlockers,
  countOfficialSources,
} from './geo-cms-validation';

const COMPLETE = {
  slug: 'uk-cost-guide',
  title: 'UK cost guide',
  description: 'Tuition and living costs for Vietnamese students in the UK.',
  excerpt: 'Tuition and living costs overview.',
  body: '# UK cost guide\n\n## Short answer\n\nMost students budget carefully.\n',
};

describe('listPublicationBlockers', () => {
  it('returns no blockers for a complete, placeholder-free article', () => {
    expect(listPublicationBlockers(COMPLETE)).toEqual([]);
  });

  it('blocks publishing when required fields are missing', () => {
    const blockers = listPublicationBlockers({
      slug: '',
      title: '  ',
      description: null,
      body: '',
    });

    expect(blockers.map((b) => b.code)).toEqual([
      'MISSING_SLUG',
      'MISSING_TITLE',
      'MISSING_DESCRIPTION',
      'MISSING_BODY',
    ]);
  });

  it('blocks TODO_SOURCE_REQUIRED markers anywhere a reader can see them', () => {
    const inBody = listPublicationBlockers({ ...COMPLETE, body: `${COMPLETE.body}\n- TODO_SOURCE_REQUIRED: fees` });
    const inDescription = listPublicationBlockers({ ...COMPLETE, description: 'TODO_SOURCE_REQUIRED' });
    const inExcerpt = listPublicationBlockers({ ...COMPLETE, excerpt: 'TODO_SOURCE_REQUIRED' });

    expect(inBody.map((b) => b.code)).toContain('PLACEHOLDER_SOURCE_MARKER');
    expect(inDescription.map((b) => b.code)).toContain('PLACEHOLDER_SOURCE_MARKER');
    expect(inExcerpt.map((b) => b.code)).toContain('PLACEHOLDER_SOURCE_MARKER');
  });

  it('blocks generator draft copy in the description or excerpt', () => {
    const draftDescription = listPublicationBlockers({
      ...COMPLETE,
      description: "A Glowbal draft guide for vietnamese undergraduate applicant",
    });
    const placeholderExcerpt = listPublicationBlockers({ ...COMPLETE, excerpt: 'placeholder text' });

    expect(draftDescription.map((b) => b.code)).toContain('PLACEHOLDER_COPY');
    expect(placeholderExcerpt.map((b) => b.code)).toContain('PLACEHOLDER_COPY');
    expect(hasPlaceholderPublicationQuality({ ...COMPLETE, description: 'A clean description' })).toBe(true);
    expect(hasPlaceholderPublicationQuality({ ...COMPLETE, description: 'A Glowbal draft guide' })).toBe(false);
  });

  it('does not flag clean published content as placeholder quality', () => {
    expect(hasPlaceholderPublicationQuality(COMPLETE)).toBe(true);
  });

  it('requires a verified official source before specific cost or entry numbers may publish', () => {
    const claimsBody = 'Annual tuition is £24,000 for international students. IELTS 6.5 overall is required.';
    const unverified = listPublicationBlockers({ ...COMPLETE, body: claimsBody });

    expect(unverified.map((b) => b.code)).toContain('UNVERIFIED_FACTUAL_CLAIMS');

    const verified = listPublicationBlockers({ ...COMPLETE, body: claimsBody, officialSourceCount: 1 });
    expect(verified.map((b) => b.code)).not.toContain('UNVERIFIED_FACTUAL_CLAIMS');
  });

  it('flags prose without any numbers as claim-free', () => {
    const blockers = listPublicationBlockers({
      ...COMPLETE,
      body: 'Living costs vary by city and lifestyle. Plan ahead.',
    });

    expect(blockers.map((b) => b.code)).not.toContain('UNVERIFIED_FACTUAL_CLAIMS');
  });

  it('enforces the configured human-review requirement only when configured', () => {
    const configured = listPublicationBlockers({ ...COMPLETE, requireHumanReview: true });
    expect(configured.map((b) => b.code)).toContain('HUMAN_REVIEW_REQUIRED');

    const approved = listPublicationBlockers({
      ...COMPLETE,
      requireHumanReview: true,
      humanReviewApproved: true,
    });
    expect(approved).toEqual([]);

    expect(listPublicationBlockers(COMPLETE)).toEqual([]);
  });
});

describe('countOfficialSources', () => {
  it('counts official source types from meta.sources', () => {
    expect(
      countOfficialSources({
        sources: [
          { sourceType: 'official-university' },
          { sourceType: 'blog' },
          { sourceType: 'official-government' },
        ],
      }),
    ).toBe(2);
  });

  it('falls back to an explicit meta.officialSourceCount', () => {
    expect(countOfficialSources({ officialSourceCount: 3 })).toBe(3);
  });

  it('returns zero when no source signal exists', () => {
    expect(countOfficialSources(undefined)).toBe(0);
    expect(countOfficialSources({ sources: [{ sourceType: 'forum' }] })).toBe(0);
  });
});
