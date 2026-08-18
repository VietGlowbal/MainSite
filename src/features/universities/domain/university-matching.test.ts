import { describe, expect, it } from 'vitest';
import {
  normalizeBudget,
  normalizeRecommendationProfile,
  normalizeStudyLevel,
  rankUniversityRecommendations,
  type RecommendationProgramme,
  type RecommendationUniversity,
} from './university-recommendation';

const asOf = '2026-08-18T00:00:00.000Z';

const profile = {
  study_level: 'Postgraduate (Masters)',
  target_subjects: ['Computer Science'],
  preferred_countries: ['Canada'],
  budget_range: '$20,000–$30,000 / year',
  campus_preferences: 'Big city',
};

function university(overrides: Partial<RecommendationUniversity> = {}): RecommendationUniversity {
  return {
    id: 1,
    name: 'Fixture University',
    country: 'Canada',
    strengths: null,
    best_for: null,
    international_environment: null,
    housing: null,
    teaching_style: null,
    tuition_usd: null,
    ...overrides,
  };
}

function programme(overrides: Partial<RecommendationProgramme> = {}): RecommendationProgramme {
  return {
    id: 'programme-1',
    universityId: 1,
    name: 'MSc Computer Science',
    degreeLevel: 'master',
    normalizedSubject: 'Computer Science',
    officialUrl: 'https://example.com/programme-1',
    verificationStatus: 'RULE_VALIDATED',
    retrievedAt: asOf,
    ...overrides,
  };
}

function programmeMap(...entries: RecommendationProgramme[]): Map<number, RecommendationProgramme[]> {
  const result = new Map<number, RecommendationProgramme[]>();
  for (const entry of entries) {
    const current = result.get(entry.universityId) ?? [];
    current.push(entry);
    result.set(entry.universityId, current);
  }
  return result;
}

describe('university recommendation v1', () => {
  it('normalizes the real profile budget and study-level variants', () => {
    expect(normalizeBudget('$10,000–$20,000 / year')).toEqual({
      currency: 'USD',
      minAnnual: 10_000,
      maxAnnual: 20_000,
      flexible: false,
    });
    expect(normalizeStudyLevel('Postgraduate (Masters)')).toBe('postgraduate');
    expect(normalizeStudyLevel("Master's")).toBe('postgraduate');
    expect(normalizeBudget('Flexible / Scholarship dependent')).toEqual({
      currency: null,
      minAnnual: null,
      maxAnnual: null,
      flexible: true,
    });
  });

  it.each([
    ['subject only', { study_level: null, target_subjects: ['Computer Science'], preferred_countries: [], budget_range: null, campus_preferences: null }, 1],
    ['country only', { study_level: null, target_subjects: [], preferred_countries: ['Canada'], budget_range: null, campus_preferences: null }, 1],
    ['subject and country', { study_level: null, target_subjects: ['Computer Science'], preferred_countries: ['Canada'], budget_range: null, campus_preferences: null }, 1],
    ['budget only', { study_level: null, target_subjects: [], preferred_countries: [], budget_range: '$20,000-$35,000 / year', campus_preferences: null }, 1],
  ])('supports a meaningful incomplete profile: %s', (_label, input, expectedScore) => {
    const result = rankUniversityRecommendations(
      input,
      [university({ country: 'Canada', tuition_usd: '$25,000 per year' })],
      programmeMap(programme()),
      { asOf },
    );

    expect(result.status).toBe('success');
    expect(result.results[0].rankingScoreInternal).toBe(expectedScore);
  });

  it('keeps flexible scholarship-dependent budgets unknown, not unlimited', () => {
    const normalized = normalizeRecommendationProfile({
      study_level: null,
      target_subjects: ['Computer Science'],
      preferred_countries: [],
      budget_range: 'Flexible / Scholarship dependent',
      campus_preferences: null,
    });
    const response = rankUniversityRecommendations(
      { study_level: null, target_subjects: ['Computer Science'], preferred_countries: [], budget_range: 'Flexible / Scholarship dependent', campus_preferences: null },
      [university({ strengths: 'Computer Science', tuition_usd: '$1,000 per year' })],
      new Map(),
      { asOf },
    );
    const result = response.results[0];

    expect(normalized.budget).toBeNull();
    expect(normalized.fundingPreference).toEqual({ scholarshipDependent: true });
    expect(normalized.activeDimensions).toEqual(['subject']);
    expect(response.status).toBe('success');
    expect(result.rankingScoreInternal).toBe(0.25);
    expect(result.positiveEvidence).toBe(0.5);
    expect(result.negativeEvidence).toBe(0.5);
    expect(result.evidenceCoverage).toBe(1);
    expect(result.reasons).not.toContainEqual(expect.objectContaining({ code: 'BUDGET_COMPATIBLE' }));
    expect(result.warnings.map((warning) => warning.code)).toContain('SCHOLARSHIP_DEPENDENT_BUDGET');
    expect(result.warnings.map((warning) => warning.code)).not.toContain('COST_NEEDS_VERIFICATION');

    expect(rankUniversityRecommendations(
      { study_level: null, target_subjects: [], preferred_countries: [], budget_range: 'Flexible / Scholarship dependent', campus_preferences: null },
      [university()],
      new Map(),
      { asOf },
    ).status).toBe('incomplete_profile');
  });

  it('keeps numeric budget evidence conservative across compatible, over-budget, currency, and period cases', () => {
    const numericProfile = {
      study_level: null,
      target_subjects: [],
      preferred_countries: [],
      budget_range: '$20,000-$30,000 / year',
      campus_preferences: null,
    };
    const evaluate = (tuition_usd: string | null) => rankUniversityRecommendations(
      numericProfile,
      [university({ tuition_usd })],
      new Map(),
      { asOf },
    ).results[0];

    const cheaper = evaluate('$15,000 per year');
    const compatible = evaluate('$25,000 per year');
    const overBudget = evaluate('$35,000 per year');
    const crossesBudgetCap = evaluate('$25,000-$35,000 per year');
    const currencyMismatch = evaluate('£25,000 per year');
    const periodMismatch = evaluate('$2,000 per month');
    const unparseable = evaluate('Contact admissions for tuition details');

    expect(cheaper.positiveEvidence).toBe(1);
    expect(cheaper.negativeEvidence).toBe(0);
    expect(compatible.positiveEvidence).toBe(1);
    expect(compatible.negativeEvidence).toBe(0);
    expect(overBudget.positiveEvidence).toBe(0);
    expect(overBudget.negativeEvidence).toBe(1);
    expect(crossesBudgetCap.positiveEvidence).toBe(0.5);
    expect(crossesBudgetCap.negativeEvidence).toBe(0.5);
    expect(crossesBudgetCap.warnings.map((warning) => warning.code)).toContain('COST_NEEDS_VERIFICATION');
    expect(currencyMismatch.evidenceCoverage).toBe(0);
    expect(currencyMismatch.warnings.map((warning) => warning.code)).toContain('CONFLICTING_DATA');
    expect(periodMismatch.evidenceCoverage).toBe(0);
    expect(unparseable.evidenceCoverage).toBe(0);
  });

  it('treats a single annual budget amount as a maximum affordability cap', () => {
    const result = rankUniversityRecommendations(
      { study_level: null, target_subjects: [], preferred_countries: [], budget_range: '$25k / year', campus_preferences: null },
      [university({ tuition_usd: '$20,000 per year' })],
      new Map(),
      { asOf },
    ).results[0];

    expect(result.positiveEvidence).toBe(1);
    expect(result.negativeEvidence).toBe(0);
  });

  it('keeps missing candidate evidence in the denominator', () => {
    const result = rankUniversityRecommendations(
      { ...profile, preferred_countries: ['Canada'], budget_range: null, campus_preferences: null },
      [university({ strengths: null })],
      new Map(),
      { asOf },
    ).results[0];

    expect(result.positiveEvidence).toBeCloseTo(0.2 / 0.75);
    expect(result.rankingScoreInternal).toBeCloseTo(0.2 / 0.75);
    expect(result.evidenceCoverage).toBeCloseTo(0.2 / 0.75);
  });

  it('does not include inactive student dimensions in the denominator', () => {
    const result = rankUniversityRecommendations(
      {
        study_level: null,
        target_subjects: ['Computer Science'],
        preferred_countries: [],
        budget_range: null,
        campus_preferences: null,
      },
      [university()],
      programmeMap(programme()),
      { asOf },
    ).results[0];

    expect(result.rankingScoreInternal).toBe(1);
    expect(result.evidenceCoverage).toBe(1);
  });

  it('keeps an absent subject out of a partial catalogue as unknown evidence', () => {
    const result = rankUniversityRecommendations(
      { study_level: null, target_subjects: ['Computer Science'], preferred_countries: [], budget_range: null, campus_preferences: null },
      [university()],
      programmeMap(
        programme({ id: 'mba', name: 'Master of Business Administration', normalizedSubject: 'Business Management', degreeLevel: 'master' }),
        programme({ id: 'economics', name: 'BA Economics', normalizedSubject: 'Economics', degreeLevel: 'bachelor' }),
      ),
      { asOf },
    ).results[0];

    expect(result.positiveEvidence).toBe(0);
    expect(result.negativeEvidence).toBe(0);
    expect(result.evidenceCoverage).toBe(0);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'NO_MATCHING_PROGRAMME_FOUND' }));
    expect(result.reasons).not.toContainEqual(expect.objectContaining({ code: 'PROGRAMME_FOUND' }));
  });

  it('uses phrase boundaries for subject matching', () => {
    const art = rankUniversityRecommendations(
      { study_level: null, target_subjects: ['Art'], preferred_countries: [], budget_range: null, campus_preferences: null },
      [university()],
      programmeMap(programme({ name: 'BSc Artificial Intelligence', normalizedSubject: 'Artificial Intelligence' })),
      { asOf },
    ).results[0];
    const computerScience = rankUniversityRecommendations(
      { study_level: null, target_subjects: ['Computer Science'], preferred_countries: [], budget_range: null, campus_preferences: null },
      [university()],
      programmeMap(programme({ name: 'MSc Computer Science and Artificial Intelligence', normalizedSubject: null })),
      { asOf },
    ).results[0];

    expect(art.programmeMatches).toEqual([]);
    expect(art.negativeEvidence).toBe(0);
    expect(art.warnings).toContainEqual(expect.objectContaining({ code: 'NO_MATCHING_PROGRAMME_FOUND' }));
    expect(computerScience.programmeMatches.map((item) => item.programmeName)).toEqual(['MSc Computer Science and Artificial Intelligence']);
    expect(computerScience.positiveEvidence).toBe(1);
  });

  it('does not infer absence of postgraduate subject programme from a partial catalogue', () => {
    const constrainedProfile = {
      study_level: 'postgraduate',
      target_subjects: ['Computer Science'],
      preferred_countries: [],
      budget_range: null,
      campus_preferences: null,
    };
    const bachelorCsAndMba = rankUniversityRecommendations(
      constrainedProfile,
      [university()],
      programmeMap(
        programme({ id: 'bsc-cs', name: 'BSc Computer Science', degreeLevel: 'bachelor' }),
        programme({ id: 'mba', name: 'Master of Business Administration', normalizedSubject: 'Business Management', degreeLevel: 'master' }),
      ),
      { asOf },
    ).results[0];

    expect(bachelorCsAndMba.reasons.map((reason) => reason.code)).toContain('SUBJECT_MATCH');
    expect(bachelorCsAndMba.reasons.map((reason) => reason.code)).not.toContain('STUDY_LEVEL_MATCH');
    expect(bachelorCsAndMba.positiveEvidence).toBeCloseTo(0.4 / 0.55);
    expect(bachelorCsAndMba.negativeEvidence).toBe(0);
    expect(bachelorCsAndMba.evidenceCoverage).toBeCloseTo(0.4 / 0.55);
    expect(bachelorCsAndMba.warnings).toContainEqual(expect.objectContaining({ code: 'MATCHING_STUDY_LEVEL_NOT_FOUND' }));
  });

  it('confirms level when a relevant programme at that level exists', () => {
    const constrainedProfile = {
      study_level: 'postgraduate',
      target_subjects: ['Computer Science'],
      preferred_countries: [],
      budget_range: null,
      campus_preferences: null,
    };
    const bachelorAndMasterCs = rankUniversityRecommendations(
      constrainedProfile,
      [university()],
      programmeMap(
        programme({ id: 'bsc-cs', name: 'BSc Computer Science', degreeLevel: 'bachelor' }),
        programme({ id: 'msc-cs', name: 'MSc Computer Science', degreeLevel: 'master' }),
      ),
      { asOf },
    ).results[0];

    expect(bachelorAndMasterCs.reasons.map((reason) => reason.code)).toContain('STUDY_LEVEL_MATCH');
    expect(bachelorAndMasterCs.positiveEvidence).toBe(1);
  });

  it('allows a catalogue programme to confirm level when subject is inactive', () => {
    const postgraduateOnly = rankUniversityRecommendations(
      {
        study_level: 'postgraduate',
        target_subjects: [],
        preferred_countries: [],
        budget_range: null,
        campus_preferences: null,
      },
      [university()],
      programmeMap(programme({ id: 'mba', name: 'Master of Business Administration', normalizedSubject: 'Business Management', degreeLevel: 'master' })),
      { asOf },
    ).results[0];

    expect(postgraduateOnly.reasons.map((reason) => reason.code)).toContain('STUDY_LEVEL_MATCH');
    expect(postgraduateOnly.positiveEvidence).toBe(1);
  });

  it('does not let one perfect field beat a candidate with complete strong evidence', () => {
    const complete = university({
      id: 1,
      name: 'Complete University',
      international_environment: 'Big city campus',
      tuition_usd: '$25,000 per year',
    });
    const partial = university({ id: 2, name: 'Partial University', country: '', strengths: null });
    const result = rankUniversityRecommendations(
      profile,
      [partial, complete],
      programmeMap(programme({ universityId: 1 }), programme({ id: 'partial', universityId: 2 })),
      { asOf },
    );

    expect(result.results.map((item) => item.universityId)).toEqual([1, 2]);
    expect(result.results[0].rankingScoreInternal).toBeGreaterThan(result.results[1].rankingScoreInternal ?? -1);
    expect(result.results[0].evidenceCoverage).toBe(1);
  });

  it('treats missing budget as unknown rather than a positive match', () => {
    const result = rankUniversityRecommendations(
      profile,
      [university({
        strengths: 'Computer Science',
        best_for: 'Postgraduate study',
        international_environment: 'Big city campus',
      })],
      new Map(),
      { asOf },
    ).results[0];

    expect(result.reasons.some((reason) => reason.code === 'BUDGET_COMPATIBLE')).toBe(false);
    expect(result.warnings.map((warning) => warning.code)).toContain('TUITION_DATA_MISSING');
    expect(result.evidenceCoverage).toBeCloseTo(0.7);
  });

  it('keeps verified mismatch, unknown evidence, and coverage semantically distinct', () => {
    const mismatch = rankUniversityRecommendations(
      { ...profile, target_subjects: [], preferred_countries: ['Canada'], budget_range: null, campus_preferences: null, study_level: null },
      [university({ id: 1, country: 'Australia' })],
      new Map(),
      { asOf },
    ).results[0];
    const unknown = rankUniversityRecommendations(
      { ...profile, target_subjects: [], preferred_countries: ['Canada'], budget_range: null, campus_preferences: null, study_level: null },
      [university({ id: 2, country: null })],
      new Map(),
      { asOf },
    ).results[0];

    expect(mismatch.rankingScoreInternal).toBe(0);
    expect(mismatch.negativeEvidence).toBe(0.2 / 0.2);
    expect(mismatch.evidenceCoverage).toBe(1);
    expect(unknown.rankingScoreInternal).toBe(0);
    expect(unknown.negativeEvidence).toBe(0);
    expect(unknown.evidenceCoverage).toBe(0);

    const ordered = rankUniversityRecommendations(
      { ...profile, target_subjects: [], preferred_countries: ['Canada'], budget_range: null, campus_preferences: null, study_level: null },
      [university({ id: 1, country: 'Australia' }), university({ id: 2, country: null })],
      new Map(),
      { asOf },
    );
    expect(ordered.results.map((item) => item.universityId)).toEqual([2, 1]);
  });

  it('does not classify a missing or old programme timestamp as fresh evidence', () => {
    const missingTimestamp = rankUniversityRecommendations(
      { ...profile, study_level: null, budget_range: null, campus_preferences: null },
      [university()],
      programmeMap(programme({ retrievedAt: null })),
      { asOf },
    ).results[0];
    const oldTimestamp = rankUniversityRecommendations(
      { ...profile, study_level: null, budget_range: null, campus_preferences: null },
      [university()],
      programmeMap(programme({ retrievedAt: '2020-01-01T00:00:00.000Z' })),
      { asOf },
    ).results[0];

    expect(missingTimestamp.warnings.map((warning) => warning.code)).toContain('SOURCE_FRESHNESS_UNKNOWN');
    expect(oldTimestamp.warnings.map((warning) => warning.code)).not.toContain('STALE_SOURCE');
  });

  it('prefers verified catalogue evidence over a university text signal', () => {
    const verified = university({ id: 1, name: 'Verified University' });
    const textOnly = university({ id: 2, name: 'Text Only University', strengths: 'Computer Science' });
    const result = rankUniversityRecommendations(
      { ...profile, budget_range: null, campus_preferences: null, study_level: null },
      [textOnly, verified],
      programmeMap(programme({ universityId: 1 })),
      { asOf },
    );

    expect(result.results.map((item) => item.universityId)).toEqual([1, 2]);
    expect(result.results[0].reasons.map((reason) => reason.code)).toContain('PROGRAMME_FOUND');
    expect(result.results[1].reasons.map((reason) => reason.code)).toContain('SUBJECT_SIGNAL_FOUND');
    expect(result.results[1].warnings.map((warning) => warning.code)).toContain('PROGRAMME_NOT_VERIFIED');
  });

  it('orders programme evidence quality within the subject dimension, not as a global bucket', () => {
    const result = rankUniversityRecommendations(
      { ...profile, study_level: null, budget_range: null, campus_preferences: null },
      [
        university({ id: 1, name: 'Needs Review' }),
        university({ id: 2, name: 'Unknown Status' }),
        university({ id: 3, name: 'Human Verified' }),
      ],
      programmeMap(
        programme({ id: 'review', universityId: 1, verificationStatus: 'NEEDS_REVIEW' }),
        programme({ id: 'unknown', universityId: 2, verificationStatus: null }),
        programme({ id: 'human', universityId: 3, verificationStatus: 'HUMAN_VERIFIED' }),
      ),
      { asOf },
    );

    expect(result.results.map((item) => item.universityId)).toEqual([3, 1, 2]);
    expect(result.results[0].rankingScoreInternal).toBeGreaterThan(result.results[1].rankingScoreInternal ?? -1);
    expect(result.results[1].warnings.map((warning) => warning.code)).toContain('PROGRAMME_NOT_VERIFIED');
  });

  it('keeps adversarial sparse, broad-fit, mismatch, unknown, and explicit-mismatch candidates defensible', () => {
    const adversarialProfile = profile;
    const sparsePerfect = university({ id: 1, name: 'A - Sparse perfect', country: null });
    const broadGood = university({
      id: 2,
      name: 'B - Broad good fit',
      country: 'Canada',
      strengths: 'Computer Science',
      best_for: 'Postgraduate study',
      international_environment: 'Big city campus',
      tuition_usd: '$20,000 per year',
    });
    const verifiedButBad = university({
      id: 3,
      name: 'C - Verified subject, bad overall fit',
      country: 'Australia',
      tuition_usd: '$60,000 per year',
      international_environment: 'Rural campus',
    });
    const unknown = university({ id: 4, name: 'D - Unknown', country: null });
    const broadMismatch = university({
      id: 5,
      name: 'E - Explicit broad mismatch',
      country: 'Australia',
      tuition_usd: '$60,000 per year',
      international_environment: 'Rural campus',
      strengths: 'History',
    });
    const result = rankUniversityRecommendations(
      adversarialProfile,
      [sparsePerfect, broadGood, verifiedButBad, unknown, broadMismatch],
      programmeMap(
        programme({ id: 'a', universityId: 1, degreeLevel: null }),
        programme({ id: 'c', universityId: 3, degreeLevel: 'undergraduate' }),
        programme({ id: 'e', universityId: 5, name: 'BA History', normalizedSubject: 'History', degreeLevel: 'undergraduate' }),
      ),
      { asOf },
    );

    expect(result.results.map((item) => item.universityId)).toEqual([2, 1, 3, 4, 5]);
    expect(result.results.map((item) => item.negativeEvidence)).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(0),
      expect.closeTo(0.45),
      expect.closeTo(0),
      expect.closeTo(0.45),
    ]);
    expect(result.results[0].rankingScoreInternal).toBeGreaterThan(result.results[1].rankingScoreInternal ?? -1);
    expect(result.results[1].rankingScoreInternal).toBeGreaterThan(result.results[2].rankingScoreInternal ?? -1);
    expect(result.results[3].rankingScoreInternal).toBe(0);
    expect(result.results[4].warnings.map((warning) => warning.code)).toContain('NO_MATCHING_PROGRAMME_FOUND');
  });

  it('lets a sparse .40 fit beat a .405 fit with verified negative evidence', () => {
    const result = rankUniversityRecommendations(
      profile,
      [
        university({
          id: 1,
          name: 'X - Slightly higher positive, heavily negative',
          country: 'Australia',
          tuition_usd: '$25,000-$35,000 / year',
          international_environment: 'City outskirts',
        }),
        university({ id: 2, name: 'Y - Sparse verified subject', country: null }),
      ],
      programmeMap(
        programme({ id: 'x', universityId: 1, verificationStatus: null, degreeLevel: 'undergraduate' }),
        programme({ id: 'y', universityId: 2, degreeLevel: null }),
      ),
      { asOf },
    );

    const x = result.results.find((item) => item.universityId === 1);
    const y = result.results.find((item) => item.universityId === 2);
    expect(x?.positiveEvidence).toBeCloseTo(0.405);
    expect(x?.negativeEvidence).toBeCloseTo(0.445);
    expect(y?.positiveEvidence).toBeCloseTo(0.4);
    expect(y?.negativeEvidence).toBe(0);
    expect(result.results.map((item) => item.universityId)).toEqual([2, 1]);
    expect(y?.rankingScoreInternal).toBeCloseTo(0.4);
    expect(x?.rankingScoreInternal).toBeCloseTo(0.405 * 0.555);
  });

  it('preserves the most relevant three programme matches', () => {
    const programmes = [
      programme({ id: 'a', name: 'MSc Computer Science', universityId: 1 }),
      programme({ id: 'b', name: 'MSc Computer Science and Artificial Intelligence', universityId: 1, normalizedSubject: 'Computer Science and Artificial Intelligence' }),
      programme({ id: 'c', name: 'MSc Software Engineering', universityId: 1, normalizedSubject: 'Computer Science and Software Engineering' }),
      programme({ id: 'd', name: 'MSc Computer Science and Data Science', universityId: 1, normalizedSubject: 'Computer Science and Data Science' }),
    ];
    const result = rankUniversityRecommendations(profile, [university()], programmeMap(...programmes), { asOf }).results[0];

    expect(result.programmeMatches).toHaveLength(3);
    expect(result.programmeMatches.map((item) => item.programmeId)).toEqual(['a', 'b', 'd']);
  });

  it('never presents rejected programme evidence as confirmed', () => {
    const result = rankUniversityRecommendations(
      { ...profile, budget_range: null, campus_preferences: null, study_level: null },
      [university()],
      programmeMap(programme({ verificationStatus: 'REJECTED' })),
      { asOf },
    ).results[0];

    expect(result.programmeMatches).toEqual([]);
    expect(result.reasons).not.toContainEqual(expect.objectContaining({ code: 'PROGRAMME_FOUND' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'PROGRAMME_DATA_MISSING' }));
  });

  it('sorts ties stably and does not change existing scores when an unrelated candidate is added', () => {
    const candidates = [university({ id: 2, name: 'Second University' }), university({ id: 1, name: 'First University' })];
    const withoutExtra = rankUniversityRecommendations(
      { ...profile, study_level: null, budget_range: null, campus_preferences: null },
      candidates,
      new Map(),
      { asOf },
    );
    const withExtra = rankUniversityRecommendations(
      { ...profile, study_level: null, budget_range: null, campus_preferences: null },
      [...candidates, university({ id: 99, name: 'Unrelated University', country: 'Australia' })],
      new Map(),
      { asOf },
    );

    expect(withoutExtra.results.map((item) => item.universityId)).toEqual([1, 2]);
    expect(withExtra.results.slice(0, 2).map((item) => item.universityId)).toEqual([1, 2]);
    expect(withExtra.results.slice(0, 2).map((item) => item.rankingScoreInternal)).toEqual(
      withoutExtra.results.map((item) => item.rankingScoreInternal),
    );
  });

  it('returns a dedicated incomplete profile response', () => {
    const response = rankUniversityRecommendations(
      { study_level: null, target_subjects: [], preferred_countries: [], budget_range: null, campus_preferences: null },
      [university()],
      new Map(),
      { asOf },
    );

    expect(response.status).toBe('incomplete_profile');
    expect(response.results).toEqual([]);
  });
});
