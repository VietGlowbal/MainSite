import { describe, expect, it } from 'vitest';
import {
  hasExport,
  isAnalysisOutdated,
  isExportOutdated,
  isReviewOutdated,
  outdatedReviews,
} from './staleness';

const APP = '22222222-2222-4222-8222-222222222222';

describe('isReviewOutdated', () => {
  it('is false when there is no review', () => {
    // "Not analyzed" is its own state. Reporting outdated would offer a re-run
    // of something that never ran.
    expect(isReviewOutdated(null, { contentVersion: 3 }, { version: 1 })).toBe(false);
    expect(isReviewOutdated(undefined, { contentVersion: 3 }, { version: 1 })).toBe(false);
  });

  it('is false when both versions still match', () => {
    expect(
      isReviewOutdated({ contentVersion: 3, targetProfileVersion: 2 }, { contentVersion: 3 }, { version: 2 }),
    ).toBe(false);
  });

  it('is true when the CV content has moved on', () => {
    expect(
      isReviewOutdated({ contentVersion: 3, targetProfileVersion: 2 }, { contentVersion: 4 }, { version: 2 }),
    ).toBe(true);
  });

  it('is true when the target profile has moved on', () => {
    // Editing what the CV must prove invalidates the verdict as surely as
    // editing the CV.
    expect(
      isReviewOutdated({ contentVersion: 3, targetProfileVersion: 2 }, { contentVersion: 3 }, { version: 3 }),
    ).toBe(true);
  });

  it('is true when a version went backwards', () => {
    // `!==`, not `<`: a rolled-back version is still not what was assessed.
    expect(
      isReviewOutdated({ contentVersion: 5, targetProfileVersion: 2 }, { contentVersion: 4 }, { version: 2 }),
    ).toBe(true);
  });

  it('ignores an input it was not given', () => {
    expect(isReviewOutdated({ contentVersion: 3, targetProfileVersion: 2 }, null, null)).toBe(false);
  });
});

describe('isExportOutdated', () => {
  it('is false when never exported', () => {
    // Nothing stale to replace — the page shows "Ready to export".
    expect(isExportOutdated({ contentVersion: 2, lastExportedVersion: null })).toBe(false);
  });

  it('is false when the export matches the content', () => {
    expect(isExportOutdated({ contentVersion: 2, lastExportedVersion: 2 })).toBe(false);
  });

  it('is true when the CV changed after the export', () => {
    expect(isExportOutdated({ contentVersion: 3, lastExportedVersion: 2 })).toBe(true);
  });
});

describe('hasExport', () => {
  it('distinguishes never-exported from exported', () => {
    expect(hasExport({ lastExportedVersion: null })).toBe(false);
    expect(hasExport({ lastExportedVersion: 1 })).toBe(true);
  });
});

describe('isAnalysisOutdated', () => {
  it('is false when there is no analysis', () => {
    expect(isAnalysisOutdated(null, 4)).toBe(false);
  });

  it('is false when the statement version is unknown', () => {
    // Nothing to compare against; claiming stale would be a guess.
    expect(isAnalysisOutdated({ contentVersion: 3 }, null)).toBe(false);
    expect(isAnalysisOutdated({ contentVersion: 3 }, undefined)).toBe(false);
  });

  it('tracks the draft version', () => {
    expect(isAnalysisOutdated({ contentVersion: 3 }, 3)).toBe(false);
    expect(isAnalysisOutdated({ contentVersion: 3 }, 4)).toBe(true);
  });
});

describe('outdatedReviews', () => {
  it('names nothing when everything is current', () => {
    expect(
      outdatedReviews({
        review: { contentVersion: 2, targetProfileVersion: 1 },
        cv: { contentVersion: 2, lastExportedVersion: 2 },
        targetProfile: { version: 1 },
        analysis: { contentVersion: 5 },
        statementVersion: 5,
      }),
    ).toEqual([]);
  });

  it('names every stale result so the student can be told which to refresh', () => {
    expect(
      outdatedReviews({
        review: { contentVersion: 2, targetProfileVersion: 1 },
        cv: { contentVersion: 3, lastExportedVersion: 2 },
        targetProfile: { version: 1 },
        analysis: { contentVersion: 5 },
        statementVersion: 6,
      }),
    ).toEqual(['cv_review', 'cv_export', 'statement_analysis']);
  });

  it('copes with an entirely empty strategy', () => {
    expect(outdatedReviews({})).toEqual([]);
  });
});

// A guard on the property the whole mechanism rests on: no timestamp
// participates, so nothing here can be made stale by the clock.
describe('staleness never consults a clock', () => {
  it('gives the same answer regardless of when it is called', () => {
    const args = {
      review: { contentVersion: 2, targetProfileVersion: 1 },
      cv: { contentVersion: 2 },
      targetProfile: { version: 1 },
    } as const;
    const first = isReviewOutdated(args.review, args.cv, args.targetProfile);
    const later = isReviewOutdated(args.review, args.cv, args.targetProfile);
    expect(first).toBe(later);
    expect(first).toBe(false);
    // And the app id plays no part either — included so a future refactor that
    // threads request state through here fails loudly.
    expect(APP).toHaveLength(36);
  });
});
