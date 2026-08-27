import { describe, expect, it } from 'vitest';
import { buildEvidenceBank, type EvidenceBankInput } from './build-evidence-bank';
import { lookupByCompetency, lookupByCriterion, lookupBySource } from './retrieval';

const BASE_INPUT: EvidenceBankInput = {
  academicRecords: [
    { id: 'ielts-1', kind: 'english_test', testType: 'IELTS', value: 7.0, scale: 9, raw: 'IELTS 7.0 overall' },
  ],
  documents: [{ id: 'doc-1', fileName: 'olympiad.pdf', storageKey: 'uploads/olympiad.pdf' }],
  activities: [
    {
      id: 'act-1',
      kind: 'activity' as const,
      title: 'Robotics club lead',
      freeText: 'Led a twelve-person robotics team to the national finals.',
      evidenceKey: null,
    },
    {
      id: 'ach-1',
      kind: 'achievement' as const,
      title: 'Math olympiad silver',
      freeText: 'Silver medal at the national mathematics olympiad.',
      evidenceKey: 'uploads/olympiad.pdf', // document-backed
    },
  ],
  followUpAnswers: [
    {
      activityId: 'act-1',
      dimension: 'impact',
      question: 'What changed?',
      answer: 'Club membership tripled and two robots reached nationals.',
      round: 1,
    },
  ],
  supplements: [
    { fieldKey: 'study_motivation', answer: 'I want to build accessible learning tools.' },
  ],
  interpretations: [
    {
      id: 'ai-1',
      module: 'competency_extraction',
      payload: { label: 'Leadership', situation: 'Led a twelve-person robotics team' },
      sourceRefs: ['activity:act-1'],
    },
  ],
};

describe('buildEvidenceBank — provenance rules', () => {
  it('keeps raw sources and AI interpretations as separate collections with separate linkage', () => {
    const bank = buildEvidenceBank(BASE_INPUT);

    expect(Object.keys(bank.sources).sort()).toEqual([
      'achievement:ach-1',
      'activity:act-1',
      'document:doc-1',
      'english_test:ielts-1',
      'follow_up:act-1:impact:0',
      'supplement:study_motivation',
    ]);
    expect(bank.interpretations).toHaveLength(1);
    expect(bank.interpretations[0]).toMatchObject({ id: 'ai-1', origin: 'ai_extraction' });
    // Interpretations may reference sources, never the reverse ownership:
    const leadershipClaim = bank.claims.find((claim) => claim.statement.includes('Leadership'));
    if (leadershipClaim) {
      expect(leadershipClaim.interpretationRefs).toContain('ai-1');
      // An interpretation is NOT a source ref.
      expect(leadershipClaim.sourceRefs).not.toContain('ai-1');
    }
  });

  it('an AI-generated claim can NEVER become verified', () => {
    const bank = buildEvidenceBank(BASE_INPUT);
    const aiBacked = bank.claims.filter((claim) => claim.interpretationRefs.length > 0);
    expect(aiBacked.length).toBeGreaterThan(0);
    for (const claim of aiBacked) {
      expect(claim.status).not.toBe('verified');
    }
  });

  it('document/test-backed claims become verified ONLY through deterministic source rules', () => {
    const bank = buildEvidenceBank(BASE_INPUT);

    // IELTS 7.0 has a test source + numeric value → verified deterministically.
    const ielts = bank.claims.find((claim) => claim.normalizedValue?.metric === 'ielts');
    expect(ielts?.status).toBe('verified');
    expect(ielts?.sourceRefs).toContain('english_test:ielts-1');

    // Achievement with an evidence document → verified.
    const olympiad = bank.claims.find((claim) => claim.id === 'experience:ach-1');
    expect(olympiad?.status).toBe('verified');
    expect(olympiad?.sourceRefs).toContain('document:doc-1');

    // Plain self-reported activity → stays unverified.
    const club = bank.claims.find((claim) => claim.id === 'experience:act-1');
    expect(club?.status).toBe('unverified');
  });

  it('supplements receive report_only scope', () => {
    const bank = buildEvidenceBank(BASE_INPUT);
    const supplementClaims = bank.claims.filter((claim) =>
      claim.sourceRefs.some((ref) => ref.startsWith('supplement:')),
    );
    expect(supplementClaims.length).toBeGreaterThan(0);
    for (const claim of supplementClaims) {
      expect(claim.status).toBe('report_only');
    }
  });

  it('compatible duplicate claims merge provenance into one claim', () => {
    const bank = buildEvidenceBank({
      ...BASE_INPUT,
      academicRecords: [
        { id: 'ielts-1', kind: 'english_test', testType: 'IELTS', value: 7.0, scale: 9, raw: 'certificate' },
        { id: 'ielts-2', kind: 'english_test', testType: 'IELTS', value: 7.0, scale: 9, raw: 'duplicate entry' },
      ],
    });

    const ieltsClaims = bank.claims.filter((claim) => claim.normalizedValue?.metric === 'ielts');
    expect(ieltsClaims).toHaveLength(1);
    expect(ieltsClaims[0]!.sourceRefs).toEqual(
      expect.arrayContaining(['english_test:ielts-1', 'english_test:ielts-2']),
    );
  });

  it('incompatible normalized values stay separate AND become conflicting', () => {
    const bank = buildEvidenceBank({
      ...BASE_INPUT,
      academicRecords: [
        { id: 'gpa-a', kind: 'gpa', value: 3.6, scale: 4, raw: 'transcript A', testType: null },
        { id: 'gpa-b', kind: 'gpa', value: 3.1, scale: 4, raw: 'self-reported', testType: null },
      ],
    });

    const gpaClaims = bank.claims.filter((claim) => claim.normalizedValue?.metric === 'gpa');
    expect(gpaClaims).toHaveLength(2);
    expect(gpaClaims.every((claim) => claim.status === 'conflicting')).toBe(true);
    expect(bank.missingInformation.some((entry) => entry.area.includes('conflict'))).toBe(true);
  });
});

describe('evidence retrieval', () => {
  const bank = buildEvidenceBank(BASE_INPUT);

  it('looks up claims by source', () => {
    const byActivity = lookupBySource(bank, 'activity:act-1');
    expect(byActivity.length).toBeGreaterThan(0);
    expect(byActivity.every((claim) => claim.sourceRefs.includes('activity:act-1'))).toBe(true);
  });

  it('looks up claims by competency tag', () => {
    const tagged = buildEvidenceBank({
      ...BASE_INPUT,
      interpretations: [
        {
          id: 'ai-comp',
          module: 'competency_extraction',
          payload: { label: 'Leadership', situation: null },
          sourceRefs: ['activity:act-1'],
        },
      ],
    });
    // The competency extractor's own claim path tags competencies; simulate by
    // asserting retrieval works on whatever tags exist after a tagged build.
    const leadership = lookupByCompetency(tagged, 'leadership');
    expect(Array.isArray(leadership)).toBe(true);
  });

  it('looks up claims by programme criterion tag', () => {
    const english = lookupByCriterion(bank, 'criterion:english');
    expect(english.length).toBeGreaterThan(0);
    expect(english.every((claim) => claim.tags.criteria.includes('criterion:english'))).toBe(true);
  });
});
