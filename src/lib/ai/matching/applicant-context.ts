import type { PersonalReportV2 } from '@/features/apply/domain/personal-report';
import type { ApplicantAIState } from '../applicant-state/domain';
import type { EvidenceBank } from '@/shared/evidence/domain';

export type ApplicantMatchingContext = {
  academicRecords: Array<{
    kind: string;
    testType: string | null;
    value: number | null;
    scale: number | null;
    raw: string | null;
  }>;
  gradesSummary: string | null;
  curriculum: string | null;
  coreIdentity: {
    recurringRole: string | null;
    recurringBehaviours: string[];
    valueOrientation: string | null;
    confidence: string;
    evidenceIds: string[];
  };
  drivingForces: {
    repeatedMotivations: string[];
    isHypothesis: boolean;
    missingPersonalGrounding: string | null;
    evidenceIds: string[];
  };
  signaturePattern: {
    strength: string;
    steps: Array<{ key: string; description: string }>;
    distinctiveness: string | null;
    evidenceIds: string[];
  };
  emergingThemes: Array<{
    theme: string;
    status: string;
    explanation: string;
    evidenceIds: string[];
  }>;
  provenCapabilities: Array<{
    title: string;
    contribution: string | null;
    outcome: string | null;
    competencies: string[];
    evidenceIds: string[];
  }>;
  socialProof: Array<{
    title: string;
    organisation: string | null;
    level: string | null;
    verificationStatus: string;
    evidenceIds: string[];
  }>;
  personalPositioning: {
    statement: string | null;
    status: string;
    whyItFits: string[];
    limitations: string[];
    evidenceIds: string[];
  };
  growthSignals: Array<{
    statement: string;
    importance: string | null;
    direction: string | null;
    evidenceIds: string[];
  }>;
  competitiveAdvantages: Array<{
    statement: string;
    evidenceIds: string[];
  }>;
  keyTakeaways: Array<{
    statement: string;
    evidenceIds: string[];
  }>;
  futureDirection: {
    intended: string | null;
    academic: string | null;
    career: string | null;
  };
  preferredEnvironment: string | null;
  evidence: Array<{
    id: string;
    statement: string;
    category: string;
    status: string;
    sourceRefs: string[];
    interpretationRefs: string[];
    interpretations: Array<{
      id: string;
      module: string;
      sourceRefs: string[];
      payload: unknown;
    }>;
  }>;
};

const unique = (values: readonly string[]) => Array.from(new Set(values.filter((value) => value.trim())));
const refs = (value: { id: string }[] | undefined) => unique((value ?? []).map((item) => item.id));

/**
 * Builds the compact, structured applicant input for V3. Personal Report
 * prose is not used as an evidence substitute; every applicant claim sent to
 * a metric assessor remains tied to the canonical Evidence Bank ids.
 */
export function buildApplicantMatchingContext(args: {
  personalReport: PersonalReportV2;
  state: ApplicantAIState;
  evidenceBank: EvidenceBank;
}): ApplicantMatchingContext {
  const { personalReport, state, evidenceBank } = args;
  const coreIdentity = personalReport.coreIdentity ?? { recurringRole: null, recurringBehaviours: [], valueOrientation: null, confidence: 'low', evidenceRefs: [] };
  const drivingForce = personalReport.drivingForce ?? { repeatedMotivations: [], isHypothesis: false, missingPersonalGrounding: null, evidenceRefs: [] };
  const signaturePattern = personalReport.signaturePattern ?? { patternStrength: 'insufficient', steps: [], distinctiveness: null, evidenceRefs: [] };
  const emergingThemes = personalReport.emergingThemes ?? { themes: [] };
  const positioning = personalReport.personalPositioning ?? { statement: null, positioningStatus: 'insufficient_data', whyThisFits: [], whatPreventsStrongerPositioning: [], evidenceRefs: [] };
  const proof = personalReport.proofOfMe?.cards ?? [];
  const interpretationsById = new Map(evidenceBank.interpretations.map((item) => [item.id, item]));
  const insight = (personalReport.growthAreas ?? []).map((item) => ({
    statement: item.statement,
    importance: item.importance ?? null,
    direction: item.direction ?? null,
    evidenceIds: unique(item.evidenceIds),
  }));

  return {
    academicRecords: (state.academicProfile?.records ?? []).map((record) => ({
      kind: record.kind,
      testType: record.testType ?? null,
      value: record.value,
      scale: record.scale ?? null,
      raw: record.raw ?? null,
    })),
    gradesSummary: state.academicProfile?.gradesSummary ?? null,
    curriculum: state.academicProfile?.curriculum ?? null,
    coreIdentity: {
      recurringRole: coreIdentity.recurringRole,
      recurringBehaviours: coreIdentity.recurringBehaviours,
      valueOrientation: coreIdentity.valueOrientation,
      confidence: coreIdentity.confidence,
      evidenceIds: refs(coreIdentity.evidenceRefs),
    },
    drivingForces: {
      repeatedMotivations: drivingForce.repeatedMotivations,
      isHypothesis: drivingForce.isHypothesis,
      missingPersonalGrounding: drivingForce.missingPersonalGrounding,
      evidenceIds: refs(drivingForce.evidenceRefs),
    },
    signaturePattern: {
      strength: signaturePattern.patternStrength,
      steps: signaturePattern.steps.map(({ key, description }) => ({ key, description })),
      distinctiveness: signaturePattern.distinctiveness,
      evidenceIds: refs(signaturePattern.evidenceRefs),
    },
    emergingThemes: emergingThemes.themes.map((theme) => ({
      theme: theme.theme,
      status: theme.status,
      explanation: theme.explanation,
      evidenceIds: refs(theme.evidenceRefs),
    })),
    provenCapabilities: proof.map((card) => ({
      title: card.title,
      contribution: card.personalContribution,
      outcome: card.outcome,
      competencies: card.competenciesDemonstrated,
      evidenceIds: refs(card.evidenceRefs),
    })),
    socialProof: proof
      .filter((card) => Boolean(card.organisation || card.level || card.evidenceSource))
      .map((card) => ({
        title: card.title,
        organisation: card.organisation ?? null,
        level: card.level ?? null,
        verificationStatus: card.verificationStatus,
        evidenceIds: refs(card.evidenceRefs),
      })),
    personalPositioning: {
      statement: positioning.statement,
      status: positioning.positioningStatus,
      whyItFits: positioning.whyThisFits,
      limitations: positioning.whatPreventsStrongerPositioning,
      evidenceIds: refs(positioning.evidenceRefs),
    },
    growthSignals: insight,
    competitiveAdvantages: (personalReport.competitiveAdvantages ?? []).map((item) => ({
      statement: item.statement,
      evidenceIds: unique(item.evidenceIds),
    })),
    keyTakeaways: personalReport.keyTakeaways
      ? [
          personalReport.keyTakeaways.whatMakesYouStandOut,
          personalReport.keyTakeaways.competitiveAdvantage,
          personalReport.keyTakeaways.growthOpportunity,
        ].map((item) => ({ statement: item.statement, evidenceIds: unique(item.evidenceIds) }))
      : [],
    futureDirection: {
      intended: state.directionSignals?.intendedDirection ?? null,
      academic: state.directionSignals?.academicDirection ?? null,
      career: state.directionSignals?.careerDirection ?? null,
    },
    preferredEnvironment: state.directionSignals?.preferredEnvironment ?? null,
    evidence: evidenceBank.claims.map((claim) => ({
      id: claim.id,
      statement: claim.statement,
      category: claim.category,
      status: claim.status,
      sourceRefs: claim.sourceRefs,
      interpretationRefs: claim.interpretationRefs,
      interpretations: claim.interpretationRefs.flatMap((id) => {
        const interpretation = interpretationsById.get(id);
        if (!interpretation || !interpretation.sourceRefs.some((ref) => claim.sourceRefs.includes(ref))) return [];
        return [{
          id: interpretation.id,
          module: interpretation.module,
          sourceRefs: interpretation.sourceRefs,
          payload: interpretation.payload,
        }];
      }),
    })),
  };
}
