import { describe, expect, it } from 'vitest';
import {
  MIN_ANALYSABLE_WORDS,
  canAnalyseStatement,
  cvActionHref,
  cvActionLabel,
  cvContentStatus,
  cvReviewStatus,
  cvStatus,
  nextAction,
  statementActionHref,
  statementActionLabel,
  statementStatus,
  statusLabel,
  strategyStatus,
  targetProfileStatus,
  type CvStatusInputs,
  type StatementStatusInputs,
} from './status';
import type { WorkspaceStatus } from './types';

const APP = '22222222-2222-4222-8222-222222222222';

const EMPTY_CV: CvStatusInputs = { targetProfile: null, cv: null, review: null };

/** A CV that is genuinely finished, as the baseline to perturb. */
const READY_CV: CvStatusInputs = {
  targetProfile: { generatedAt: '2026-01-01T00:00:00Z', filledFieldCount: 7 },
  cv: {
    sectionCount: 5,
    entryCount: 9,
    selectedLayout: 'technical',
    hasExport: true,
    exportOutdated: false,
  },
  review: { criticalCount: 0, outdated: false },
};

const READY_STATEMENT: StatementStatusInputs = {
  wordCount: 620,
  analysis: { outdated: false, readiness: 'ready', unresolvedCriticalCount: 0 },
};

describe('targetProfileStatus', () => {
  it('is not started when absent', () => {
    expect(targetProfileStatus(null)).toBe('not_started');
  });

  it('needs attention when generated but every field came back empty', () => {
    // The generator is required to leave fields empty rather than invent, so
    // this is a real outcome that needs the student to add information.
    expect(targetProfileStatus({ generatedAt: '2026-01-01T00:00:00Z', filledFieldCount: 0 })).toBe(
      'needs_attention',
    );
  });

  it('is not started when never generated and empty', () => {
    expect(targetProfileStatus({ generatedAt: null, filledFieldCount: 0 })).toBe('not_started');
  });

  it('is in progress once any field has content', () => {
    expect(targetProfileStatus({ generatedAt: null, filledFieldCount: 1 })).toBe('in_progress');
  });
});

describe('cvContentStatus', () => {
  it('is not started with no sections', () => {
    expect(cvContentStatus(null)).toBe('not_started');
    expect(
      cvContentStatus({
        sectionCount: 0,
        entryCount: 0,
        selectedLayout: null,
        hasExport: false,
        exportOutdated: false,
      }),
    ).toBe('not_started');
  });

  it('is in progress for a section skeleton with no entries', () => {
    expect(
      cvContentStatus({
        sectionCount: 4,
        entryCount: 0,
        selectedLayout: null,
        hasExport: false,
        exportOutdated: false,
      }),
    ).toBe('in_progress');
  });
});

describe('cvReviewStatus', () => {
  it('is not started with no review', () => {
    expect(cvReviewStatus(null)).toBe('not_started');
  });

  it('needs attention when outdated', () => {
    expect(cvReviewStatus({ criticalCount: 0, outdated: true })).toBe('needs_attention');
  });

  it('needs attention when a critical gap remains', () => {
    expect(cvReviewStatus({ criticalCount: 2, outdated: false })).toBe('needs_attention');
  });

  it('is ready when clean and current', () => {
    expect(cvReviewStatus({ criticalCount: 0, outdated: false })).toBe('ready_for_audit');
  });
});

describe('cvStatus', () => {
  it('is not started for an untouched workspace', () => {
    expect(cvStatus(EMPTY_CV)).toBe('not_started');
  });

  it('is ready when review, layout and export are all current', () => {
    expect(cvStatus(READY_CV)).toBe('ready_for_audit');
  });

  it('attention outranks progress when the review is outdated', () => {
    // Otherwise the card invites the student to continue past the problem.
    expect(cvStatus({ ...READY_CV, review: { criticalCount: 0, outdated: true } })).toBe(
      'needs_attention',
    );
  });

  it('attention outranks progress when a critical gap remains', () => {
    expect(cvStatus({ ...READY_CV, review: { criticalCount: 1, outdated: false } })).toBe(
      'needs_attention',
    );
  });

  it('attention when the exported PDF is stale', () => {
    expect(
      cvStatus({ ...READY_CV, cv: { ...READY_CV.cv!, exportOutdated: true } }),
    ).toBe('needs_attention');
  });

  it('is not ready without a selected layout', () => {
    expect(cvStatus({ ...READY_CV, cv: { ...READY_CV.cv!, selectedLayout: null } })).toBe(
      'in_progress',
    );
  });

  it('is not ready without an export', () => {
    expect(cvStatus({ ...READY_CV, cv: { ...READY_CV.cv!, hasExport: false } })).toBe('in_progress');
  });

  it('is not ready without a review', () => {
    expect(cvStatus({ ...READY_CV, review: null })).toBe('in_progress');
  });

  it('is in progress with a target profile but no content', () => {
    expect(
      cvStatus({ targetProfile: { generatedAt: null, filledFieldCount: 3 }, cv: null, review: null }),
    ).toBe('in_progress');
  });
});

describe('statementStatus', () => {
  it('is not started for an empty draft', () => {
    expect(statementStatus({ wordCount: 0, analysis: null })).toBe('not_started');
  });

  it('is in progress for an unanalysed draft', () => {
    expect(statementStatus({ wordCount: 300, analysis: null })).toBe('in_progress');
  });

  it('needs attention when the analysis is outdated', () => {
    expect(
      statementStatus({
        wordCount: 300,
        analysis: { outdated: true, readiness: 'ready', unresolvedCriticalCount: 0 },
      }),
    ).toBe('needs_attention');
  });

  it('needs attention while critical feedback is unresolved', () => {
    expect(
      statementStatus({
        wordCount: 300,
        analysis: { outdated: false, readiness: 'ready', unresolvedCriticalCount: 1 },
      }),
    ).toBe('needs_attention');
  });

  it('needs attention when readiness fails', () => {
    expect(
      statementStatus({
        wordCount: 300,
        analysis: { outdated: false, readiness: 'needs_attention', unresolvedCriticalCount: 0 },
      }),
    ).toBe('needs_attention');
  });

  it('is ready when clean, current and readiness passes', () => {
    expect(statementStatus(READY_STATEMENT)).toBe('ready_for_audit');
  });
});

describe('canAnalyseStatement', () => {
  it('refuses a fragment so feedback is about the statement, not its length', () => {
    expect(canAnalyseStatement(0)).toBe(false);
    expect(canAnalyseStatement(MIN_ANALYSABLE_WORDS - 1)).toBe(false);
    expect(canAnalyseStatement(MIN_ANALYSABLE_WORDS)).toBe(true);
  });
});

describe('strategyStatus', () => {
  it('surfaces attention from either document', () => {
    expect(strategyStatus('needs_attention', 'ready_for_audit')).toBe('needs_attention');
    expect(strategyStatus('ready_for_audit', 'needs_attention')).toBe('needs_attention');
  });

  it('is ready only when both are ready', () => {
    expect(strategyStatus('ready_for_audit', 'ready_for_audit')).toBe('ready_for_audit');
    expect(strategyStatus('ready_for_audit', 'in_progress')).toBe('in_progress');
  });

  it('is not started only when neither has begun', () => {
    expect(strategyStatus('not_started', 'not_started')).toBe('not_started');
    expect(strategyStatus('not_started', 'in_progress')).toBe('in_progress');
  });
});

describe('action labels', () => {
  it('uses the specified CV copy for every status', () => {
    expect(cvActionLabel('not_started')).toBe('Start CV strategy');
    expect(cvActionLabel('in_progress')).toBe('Continue CV');
    expect(cvActionLabel('needs_attention')).toBe('Review CV');
    expect(cvActionLabel('ready_for_audit')).toBe('View or download CV');
  });

  it('uses the specified statement copy for every status', () => {
    expect(statementActionLabel('not_started')).toBe('Start statement');
    expect(statementActionLabel('in_progress')).toBe('Continue writing');
    expect(statementActionLabel('needs_attention')).toBe('Review feedback');
    expect(statementActionLabel('ready_for_audit')).toBe('View statement');
  });

  it('has a label and a status label for every member of the union', () => {
    const all: WorkspaceStatus[] = [
      'not_started',
      'in_progress',
      'needs_attention',
      'ready_for_audit',
    ];
    for (const s of all) {
      expect(cvActionLabel(s)).toBeTruthy();
      expect(statementActionLabel(s)).toBeTruthy();
      expect(statusLabel(s)).toBeTruthy();
    }
  });
});

describe('action hrefs', () => {
  it('sends an untouched CV to the target profile', () => {
    expect(cvActionHref(APP, EMPTY_CV)).toBe(`/ai-strategy/${APP}/cv/target-profile`);
  });

  it('sends a CV with a profile but no content to the content editor', () => {
    expect(
      cvActionHref(APP, {
        targetProfile: { generatedAt: null, filledFieldCount: 4 },
        cv: null,
        review: null,
      }),
    ).toBe(`/ai-strategy/${APP}/cv/content`);
  });

  it('sends an outdated review to the review page', () => {
    expect(cvActionHref(APP, { ...READY_CV, review: { criticalCount: 0, outdated: true } })).toBe(
      `/ai-strategy/${APP}/cv/review`,
    );
  });

  it('sends a finished CV to the layout page', () => {
    expect(cvActionHref(APP, READY_CV)).toBe(`/ai-strategy/${APP}/cv/layout`);
  });

  it('sends an empty statement to the editor without a section', () => {
    expect(statementActionHref(APP, { wordCount: 0, analysis: null })).toBe(
      `/ai-strategy/${APP}/statement`,
    );
  });

  it('sends a failed readiness check to the readiness section', () => {
    expect(
      statementActionHref(APP, {
        wordCount: 400,
        analysis: { outdated: false, readiness: 'needs_attention', unresolvedCriticalCount: 0 },
      }),
    ).toBe(`/ai-strategy/${APP}/statement?section=readiness`);
  });
});

describe('nextAction', () => {
  const call = (cv: CvStatusInputs, statement: StatementStatusInputs) =>
    nextAction({
      applicationId: APP,
      cv,
      statement,
      cvStatusValue: cvStatus(cv),
      statementStatusValue: statementStatus(statement),
    });

  it('returns exactly one action, so two primary buttons cannot be rendered', () => {
    const action = call(EMPTY_CV, { wordCount: 0, analysis: null });
    expect(Object.keys(action).sort()).toEqual(['href', 'label']);
  });

  it('hands off to Submit Audit when both documents are ready', () => {
    expect(call(READY_CV, READY_STATEMENT)).toEqual({
      href: `/ai-strategy/${APP}/audit`,
      label: 'Continue to Submit Audit',
    });
  });

  it('prioritises the CV when it needs attention', () => {
    const cv: CvStatusInputs = { ...READY_CV, review: { criticalCount: 3, outdated: false } };
    expect(call(cv, READY_STATEMENT).href).toBe(`/ai-strategy/${APP}/cv/review`);
  });

  it('prioritises the statement when only it needs attention', () => {
    const statement: StatementStatusInputs = {
      wordCount: 400,
      analysis: { outdated: true, readiness: 'ready', unresolvedCriticalCount: 0 },
    };
    expect(call(READY_CV, statement).label).toBe('Review feedback');
  });

  it('leads with the CV in a partial state, because the brief reads from it', () => {
    const statement: StatementStatusInputs = { wordCount: 0, analysis: null };
    expect(call(EMPTY_CV, statement).label).toBe('Start CV strategy');
  });

  it('moves to the statement once the CV is done', () => {
    expect(call(READY_CV, { wordCount: 0, analysis: null }).label).toBe('Start statement');
  });
});
