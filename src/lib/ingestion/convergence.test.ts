import { describe, expect, it } from 'vitest';
import {
  ConvergenceAuditStore,
  DirectWriteGuard,
  LegacyCompatibilityAdapter,
  ManualSourceAdapter,
  ProgrammeCsvAdapter,
  ScholarshipIdentityResolver,
  ScholarshipSourceAdapter,
  buildDifferentialReport,
  classifyScholarshipMapping,
  scholarshipTemporalState,
} from './convergence';

describe('Phase 3E ingestion convergence contract', () => {
  it('adapts legacy output with complete compatibility provenance and no trust', () => {
    const envelope = LegacyCompatibilityAdapter.adapt({
      legacyJobId: 'legacy-job-1',
      applicationId: 'application-1',
      sourceUrl: 'https://example.edu/programmes/ms-cs',
      parserVersion: 'course-parser/v7',
      rawRetained: false,
      result: {
        courseName: 'Computer Science',
        degreeLevel: 'Master',
        tuitionFeeText: '$20,000',
        englishRequirements: 'IELTS 6.5',
      },
    });

    expect(envelope.source.adapter).toBe('legacy_parser');
    expect(envelope.source.parserVersion).toBe('course-parser/v7');
    expect(envelope.source.lifecycle).toBe('SHADOWED');
    expect(envelope.assertions.map((item) => item.field)).toEqual([
      'programme_name',
      'degree_level',
      'tuition',
      'english_requirement',
    ]);
    expect(envelope.assertions.every((item) => item.trustedForCanonicalPromotion === false)).toBe(true);
    expect(envelope.assertions.every((item) => item.epistemic === 'DERIVED')).toBe(true);
    expect(envelope.provenanceLimitations).toContain('RAW_EVIDENCE_NOT_RETAINED');
    expect(envelope.assertions[0].provenance.legacyJobId).toBe('legacy-job-1');
    expect(envelope.assertions[0].provenance.originalValue).toBe('Computer Science');
  });

  it('describes manual URLs as Slice B-owned acquisition intents', () => {
    const first = ManualSourceAdapter.describe({
      sourceUrl: 'https://example.edu/programmes/ms-cs',
      universityId: 42,
    });
    const second = ManualSourceAdapter.describe({
      sourceUrl: 'https://example.edu/programmes/ms-cs',
      universityId: 42,
    });

    expect(first.assertions).toHaveLength(0);
    expect(first.source.lifecycle).toBe('SHADOWED');
    expect(first.acquisitionIntent?.directFetchOwner).toBe('slice_b');
    expect(first.acquisitionIntent?.requiresRawPersistence).toBe(true);
    expect(first.acquisitionIntent?.fingerprint).toBe(second.acquisitionIntent?.fingerprint);
    expect(first.canonicalWrite.allowed).toBe(false);
  });

  it('retains CSV file hash and row-level provenance', () => {
    const envelope = ProgrammeCsvAdapter.adaptRow({
      row: {
        'University Name': 'Example University',
        'Program Name': 'Computer Science',
        Degree: 'MS',
        'Program Link': 'https://example.edu/ms-cs',
        Country: 'US',
      },
      fileId: 'programmes.csv',
      fileHash: 'abc123',
      rowNumber: 19,
    });

    expect(envelope.source.fileId).toBe('programmes.csv');
    expect(envelope.source.fileHash).toBe('abc123');
    expect(envelope.source.rowLocator).toBe('row:19');
    expect(envelope.rawEvidence.locator).toContain('#row=19');
    expect(envelope.assertions.some((item) => item.field === 'credential')).toBe(true);
  });

  it('keeps scholarship identity and university mappings conservative', () => {
    const source = ScholarshipSourceAdapter.adaptRecord({
      record: { name: 'Global Award', provider_id: 'provider-1', academic_cycle: '2026' },
      fileId: 'scholarships.csv',
      fileHash: 'scholarship-file-hash',
      rowNumber: 3,
    });
    const existing = [{
      scholarshipId: 'scholarship-1',
      providerId: 'provider-1',
      schemeId: null,
      providerName: 'Provider',
      canonicalName: 'Global Award',
      academicCycle: '2026',
      decision: 'CREATED' as const,
      method: 'EXACT_PROVIDER_NAME_CYCLE' as const,
      supportingAssertionIds: [],
    }];
    const resolved = ScholarshipIdentityResolver.resolve({
      providerId: 'provider-1',
      providerName: 'Provider',
      name: 'Global Award',
      academicCycle: '2026',
    }, existing);
    const ambiguous = ScholarshipIdentityResolver.resolve({
      providerName: 'Provider',
      name: 'Global Award',
    }, existing);
    const fuzzy = classifyScholarshipMapping({
      scholarshipId: 'scholarship-1',
      universityId: 7,
      explicitRelationship: false,
      curated: false,
      candidateMethod: 'fuzzy',
      evidence: 'name similarity only',
    });

    expect(resolved.decision).toBe('RESOLVED');
    expect(ambiguous.decision).toBe('REVIEW_REQUIRED');
    expect(source.source.fileHash).toBe('scholarship-file-hash');
    expect(source.assertions.some((item) => item.field === 'scholarship_name')).toBe(true);
    expect(fuzzy.state).toBe('PROPOSED');
    expect(fuzzy.confirmed).toBe(false);
    expect(fuzzy.reviewRequired).toBe(true);
  });

  it('does not turn recurrence inference into verified ACTIVE scholarship status', () => {
    expect(scholarshipTemporalState({
      currentCycle: '2026',
      observedCycle: '2025',
      recurrenceObserved: true,
      inferred: true,
    })).toBe('EXPIRED_BUT_RECURRING');
    expect(scholarshipTemporalState({
      currentCycle: '2026',
      observedCycle: '2026',
      inferred: true,
      recurrenceObserved: true,
    })).toBe('EXPIRED_BUT_RECURRING');
  });

  it('blocks ordinary direct writes while preserving explicit compatibility paths', () => {
    expect(DirectWriteGuard.decide({
      purpose: 'csv_import',
      sourcePath: 'scripts/import-university-programs-csv.mjs',
      actor: null,
    }).disposition).toBe('BLOCKED');
    expect(DirectWriteGuard.decide({
      purpose: 'manual_url',
      sourcePath: 'src/app/api/applications/from-course-url/route.ts',
      actor: 'user-1',
    }).disposition).toBe('BLOCKED');
    expect(DirectWriteGuard.decide({
      purpose: 'legacy_compatibility',
      sourcePath: 'src/lib/course-parser/job-processor.ts',
      actor: null,
      explicitCompatibility: true,
    }).disposition).toBe('ALLOWED_COMPATIBILITY');
    expect(DirectWriteGuard.decide({
      purpose: 'v3_promotion',
      sourcePath: 'promotion-v3',
      actor: 'worker',
      contractPassed: true,
    }).disposition).toBe('ALLOWED_PRIVILEGED');
  });

  it('emits stable differential and append-only audit records', () => {
    const envelope = ManualSourceAdapter.describe({ sourceUrl: 'https://example.edu/ms-cs' });
    const report = buildDifferentialReport({
      sourcePath: 'manual-url',
      adapter: 'manual_url',
      legacyOutput: { programme_name: 'Computer Science' },
      envelope,
      identityDecision: 'UNMATCHED',
      qualityState: 'PARTIAL',
      promotionEligible: false,
      blockingReasons: ['IDENTITY_UNRESOLVED'],
    });
    const audit = new ConvergenceAuditStore();
    audit.append({
      sourcePath: 'manual-url',
      adapter: 'manual_url',
      identityDecision: 'UNMATCHED',
      qualityDecision: 'PARTIAL',
      promotionId: null,
      canonicalChange: null,
      disposition: 'BLOCKED',
      actor: null,
      reason: 'identity unresolved',
    });

    expect(report.promotionEligible).toBe(false);
    expect(report.blockingReasons).toContain('IDENTITY_UNRESOLVED');
    expect(audit.list()).toHaveLength(1);
    expect(audit.metrics()['manual_url:BLOCKED']).toBe(1);
  });
});
