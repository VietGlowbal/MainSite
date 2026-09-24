import { describe, expect, it } from 'vitest';
import type { PersonalReportV2 } from '@/features/apply/domain';
import { applyNarrativeSynthesis } from '../personal-report-narrative-synthesis';
import type { ApplicantAIState } from '../applicant-state/domain';
import type { EvidenceBank } from '@/shared/evidence/domain';
import { buildApplicantMatchingContext } from './applicant-context';

const state = { academicProfile: { records: [] }, achievements: [], activities: [], evidenceBank: [], metadata: {} } as unknown as ApplicantAIState;
const evidenceBank: EvidenceBank = { version: 'eb-v1', sources: {}, interpretations: [], claims: [], missingInformation: [] };
const canonicalEvidenceBank: EvidenceBank = {
  version: 'eb-v1',
  sources: { 'achievement:activity-1': { id: 'achievement:activity-1', type: 'achievement', label: 'Activity' } },
  interpretations: [],
  claims: [{ id: 'experience:activity-1', category: 'experience', statement: 'Activity evidence', status: 'verified', sourceRefs: ['achievement:activity-1'], interpretationRefs: [], tags: { competencies: [], criteria: [] } }],
  missingInformation: [],
};

const report = {
  coreIdentity: { recurringRole: 'organiser', recurringBehaviours: ['coordinating volunteers'], valueOrientation: 'community impact', confidence: 'medium', evidenceRefs: [{ id: 'activity-1' }] },
  drivingForce: { repeatedMotivations: ['helping learners'], isHypothesis: true, missingPersonalGrounding: null, evidenceRefs: [{ id: 'activity-1' }] },
  signaturePattern: { patternStrength: 'emerging', steps: [{ key: 'method', description: 'coordinating volunteers' }], distinctiveness: 'canonical distinctiveness', evidenceRefs: [{ id: 'activity-1' }] },
  emergingThemes: { themes: [{ theme: 'education access', status: 'emerging', explanation: 'canonical explanation', evidenceRefs: [{ id: 'theme-1' }] }] },
  personalPositioning: { statement: 'canonical positioning', positioningStatus: 'positioned', whyThisFits: ['canonical fit'], whatPreventsStrongerPositioning: [], evidenceRefs: [{ id: 'positioning-1' }] },
  proofOfMe: { cards: [{ title: 'Coding club', personalContribution: 'coordinated volunteers', outcome: 'More learners joined', competenciesDemonstrated: ['Leadership'], evidenceRefs: [{ id: 'proof-1' }], verificationStatus: 'stated' }] },
  growthAreas: [{ statement: 'Add broader evidence', importance: 'medium', direction: 'Add another experience', evidenceIds: ['activity-1'] }],
  competitiveAdvantages: [{ statement: 'Canonical advantage', evidenceIds: ['positioning-1'] }],
  keyTakeaways: {
    whatMakesYouStandOut: { statement: 'Canonical standout', evidenceIds: ['activity-1'] },
    competitiveAdvantage: { statement: 'Canonical advantage', evidenceIds: ['positioning-1'] },
    growthOpportunity: { statement: 'Canonical growth', evidenceIds: ['activity-1'] },
  },
} as unknown as PersonalReportV2;

describe('matching context narrative isolation', () => {
  it('normalizes legacy achievement refs to canonical Evidence Bank claim IDs', () => {
    const legacyReport = {
      ...report,
      coreIdentity: { ...report.coreIdentity, evidenceRefs: [{ id: 'achievement:activity-1' }] },
      growthAreas: [{ statement: 'Add broader evidence', importance: 'medium', direction: 'Add another experience', evidenceIds: ['achievement:activity-1'] }],
      competitiveAdvantages: [{ statement: 'Canonical advantage', evidenceIds: ['achievement:activity-1'] }],
      keyTakeaways: {
        whatMakesYouStandOut: { statement: 'Canonical standout', evidenceIds: ['achievement:activity-1'] },
        competitiveAdvantage: { statement: 'Canonical advantage', evidenceIds: ['positioning-1'] },
        growthOpportunity: { statement: 'Canonical growth', evidenceIds: ['activity-1'] },
      },
    } as unknown as PersonalReportV2;
    const context = buildApplicantMatchingContext({ personalReport: legacyReport, state, evidenceBank: canonicalEvidenceBank });

    expect(context.coreIdentity.evidenceIds).toEqual(['experience:activity-1']);
    expect(context.growthSignals[0].evidenceIds).toEqual(['experience:activity-1']);
    expect(context.competitiveAdvantages[0].evidenceIds).toEqual(['experience:activity-1']);
    expect(context.keyTakeaways[0].evidenceIds).toEqual(['experience:activity-1']);
  });

  it('keeps matching context identical when applicant-facing narrative is added', () => {
    const before = buildApplicantMatchingContext({ personalReport: report, state, evidenceBank });
    const after = buildApplicantMatchingContext({
      personalReport: applyNarrativeSynthesis(report, {
        narrativeDetails: {
          coreIdentity: { identityStatement: 'Different narrative wording', evidenceIds: ['activity-1'], definingTraits: [] },
          profilePositioning: {
            experienceConnection: { strongestProfileThread: 'Different thread', connectionExplanation: 'Different explanation', confidence: 'high', supportingExperienceCount: 1, evidenceIds: ['positioning-1'] },
            positioningOptions: [],
            profileNarrative: 'Different profile narrative',
            profileNarrativeEvidenceIds: ['positioning-1'],
          },
          keyTakeaways: {
            whatMakesYouStandOut: { title: 'Different', insight: 'Different', evidencePattern: 'Different', whyItMatters: 'Different', evidenceIds: ['activity-1'] },
            competitiveAdvantage: { title: 'Different', advantageStatement: 'Different', supportingEvidence: 'Different', applicationRelevance: 'Different', evidenceIds: ['positioning-1'] },
            growthOpportunity: { title: 'Different', growthArea: 'Different', currentGap: 'Different', recommendedDirection: 'Different', whyItMatters: 'Different', evidenceIds: ['activity-1'] },
          },
        },
      }),
      state,
      evidenceBank,
    });

    expect(after).toEqual(before);
  });
});
