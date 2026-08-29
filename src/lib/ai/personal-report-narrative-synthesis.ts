import { z } from 'zod';
import type {
  PersonalReportNarrativeDetails,
  PersonalReportV2,
  SignaturePatternStepKey,
} from '@/features/apply/domain';
import type {
  EvidenceRef,
  ProfileEvaluation,
  ProfileEvaluationInput,
  ReflectionAnswerKey,
  ReflectionFinding,
} from '@/shared/evaluation';
import type { EvidenceBank } from '@/shared/evidence/domain';
import type { PersonalCanvasDetails } from '@/features/apply/domain/personal-canvas-details';
import { openAiJsonCompletion } from './openai-client';
import { getReportPrompt } from './runtime/prompt-registry';

/**
 * The constrained narrative-synthesis stage (implementation spec §9, §14,
 * §25): the ONE place an LLM is allowed to touch the Personal Report's prose.
 *
 * ─── WHAT THIS DOES AND DOES NOT DO ──────────────────────────────────────────
 *
 * Every headline/paragraph/statement below is currently built by naive
 * template concatenation in `src/features/apply/domain/personal-report.ts`
 * ("Someone who ${behaviour}") — functionally correct, but exactly the
 * "low-level framework output" the redesign spec calls out. This module asks
 * a model for BETTER LANGUAGE over the SAME structured facts that module
 * already computed — it receives only already-decided structured findings
 * (recurring role/behaviour, pattern steps, positioning booleans, evidence
 * IDs) and is never shown raw free text it could invent additional facts
 * from. It cannot change a score, a confidence level, or an
 * available/insufficient-data verdict — those stay exactly what the
 * deterministic domain layer already decided; this only replaces prose for
 * sections already marked `available: true`.
 *
 * ─── VALIDATION IS THE SAFETY NET, NOT THE PROMPT ────────────────────────────
 *
 * Every evidence ID the model returns is checked against the exact set this
 * report actually has (`allowedEvidenceIds` below) — an ID outside that set
 * fails the WHOLE synthesis, not just one section, and the caller falls back
 * to the existing deterministic template copy entirely. A polished sentence
 * that cites evidence that doesn't exist is worse than a plain one that
 * doesn't, so there is no partial-acceptance path.
 */

const MAX_EVIDENCE_IDS = 12;

const evidenceIdsSchema = z.array(z.string().min(1).max(160)).min(1).max(MAX_EVIDENCE_IDS);
const traitSchema = z.object({
  characteristic: z.string().min(1).max(160),
  insight: z.string().min(1).max(500),
  evidenceIds: evidenceIdsSchema,
  whyItMatters: z.string().min(1).max(500),
  scope: z.enum(['repeated', 'emerging']),
  confidence: z.enum(['high', 'medium', 'low']),
});
const narrativeDetailsSchema = z.object({
  snapshot: z.string().min(1).max(1600).nullish(),
  coreIdentity: z.object({
    identityStatement: z.string().min(1).max(900),
    evidenceIds: evidenceIdsSchema,
    definingTraits: z.array(traitSchema).max(5),
  }).nullish(),
  drivingForce: z.object({
    primaryMotivation: z.string().min(1).max(500),
    repeatedChoices: z.array(z.string().min(1).max(300)).max(8),
    recurringProblems: z.array(z.string().min(1).max(300)).max(8),
    underlyingValues: z.array(z.string().min(1).max(300)).max(8),
    strategicInterpretation: z.string().min(1).max(700),
    evidenceStrength: z.enum(['strong', 'moderate', 'limited']),
    isHypothesis: z.boolean(),
    evidenceIds: evidenceIdsSchema,
  }).nullish(),
  provenCapabilities: z.object({
    overview: z.string().min(1).max(900),
    overviewEvidenceIds: evidenceIdsSchema,
    capabilities: z.array(z.object({
      capability: z.string().min(1).max(160),
      evidenceIds: evidenceIdsSchema,
      supportingActivities: z.array(z.string().min(1).max(160)).max(6),
      howDemonstrated: z.string().min(1).max(600),
      whyItMatters: z.string().min(1).max(600),
    })).max(4),
    combinationInsight: z.string().min(1).max(700),
    combinationEvidenceIds: evidenceIdsSchema,
  }).nullish(),
  socialProof: z.object({
    conclusion: z.string().min(1).max(700),
    metricKeys: z.array(z.string().min(1).max(80)).max(12),
    evidenceIds: evidenceIdsSchema,
  }).nullish(),
  profilePositioning: z.object({
    experienceConnection: z.object({
      strongestProfileThread: z.string().min(1).max(300),
      connectionExplanation: z.string().min(1).max(700),
      confidence: z.enum(['high', 'medium', 'low']),
      supportingExperienceCount: z.number().int().nonnegative(),
      evidenceIds: evidenceIdsSchema,
    }),
    positioningOptions: z.array(z.object({
      title: z.string().min(1).max(160),
      statement: z.string().min(1).max(500),
      supportingEvidenceIds: evidenceIdsSchema,
      supportingExperienceTitles: z.array(z.string().min(1).max(160)).max(6),
    })).max(3),
    profileNarrative: z.string().min(1).max(1000),
    profileNarrativeEvidenceIds: evidenceIdsSchema,
  }).nullish(),
  keyTakeaways: z.object({
    whatMakesYouStandOut: z.object({
      title: z.string().min(1).max(160),
      insight: z.string().min(1).max(500),
      evidencePattern: z.string().min(1).max(500),
      whyItMatters: z.string().min(1).max(500),
      evidenceIds: evidenceIdsSchema,
    }),
    competitiveAdvantage: z.object({
      title: z.string().min(1).max(160),
      advantageStatement: z.string().min(1).max(500),
      supportingEvidence: z.string().min(1).max(500),
      applicationRelevance: z.string().min(1).max(500),
      evidenceIds: evidenceIdsSchema,
    }),
    growthOpportunity: z.object({
      title: z.string().min(1).max(160),
      growthArea: z.string().min(1).max(500),
      currentGap: z.string().min(1).max(500),
      recommendedDirection: z.string().min(1).max(500),
      whyItMatters: z.string().min(1).max(500),
      basis: z.enum(['evidence', 'missing_information']),
      evidenceIds: z.array(z.string().min(1).max(160)).max(MAX_EVIDENCE_IDS),
    }),
  }).nullish(),
}).partial();

const synthesisResponseSchema = z.object({
  narrativeDetails: narrativeDetailsSchema.nullish(),
});

export type PersonalReportNarrativeSynthesis = {
  narrativeDetails?: PersonalReportNarrativeDetails;
};

export type PersonalReportNarrativeGrounding = {
  evaluationInput: ProfileEvaluationInput;
  evaluation: ProfileEvaluation;
  evidenceBank: EvidenceBank | null;
  canvasDetails?: PersonalCanvasDetails;
};

export type PersonalReportNarrativeFailureCode =
  | 'invalid_json'
  | 'schema_snapshot_summary'
  | 'schema_response'
  | 'missing_sections'
  | 'invalid_evidence_scope'
  | 'output_truncated'
  | 'timeout'
  | 'provider_error'
  | 'unsupported_narrative_fact'
  | 'unsupported_narrative_voice'
  | 'hypothesis_promotion'
  | 'report_mechanics_prose'
  | 'invalid_word_length'
  | 'unknown';

export type PersonalReportNarrativeFailureIssue = {
  path: string[];
  code: string;
  message: string;
};

export type PersonalReportNarrativeFailureContext = {
  batch?: string[];
  issues?: PersonalReportNarrativeFailureIssue[];
};

// Prompt text and its version live in the shared registry (Task 2).
const { systemPrompt: SYSTEM_PROMPT } = getReportPrompt('report_narrative_synthesis');

type SynthesisSectionInput = {
  coreIdentity: {
    recurringRole: string | null;
    recurringBehaviour: string | null;
    valueOrientation: string | null;
    observations: string[];
    recurringBehaviours: string[];
    observedBehaviours: string[];
    corroboratedReflections: ReflectionFindingWithStatus[];
    drivingForceStatus: string;
    signaturePattern: Array<{ key: SignaturePatternStepKey; label: string; description: string }>;
    patternMaturity: string;
    evidenceIds: string[];
    traitCandidates: Array<{ characteristic: string; evidenceIds: string[]; scope: 'repeated' | 'emerging'; confidence: 'high' | 'medium' | 'low' }>;
  } | null;
  drivingForce: {
    statedMotivation: string | null;
    isHypothesis: boolean;
    repeatedMotivations: string[];
    missingPersonalGrounding: string | null;
    reflectionFindings: ReflectionFindingWithStatus[];
    cmcaitfMotivations: string[];
    activityChoices: string[];
    domainThemes: string[];
    actions: string[];
    motivationStatus: string;
    evidenceStrength: string;
    evidenceIds: string[];
  } | null;
  signaturePattern: {
    patternStrength: 'established' | 'emerging';
    steps: { key: SignaturePatternStepKey; label: string; description: string }[];
  } | null;
  emergingThemes: {
    themes: Array<{
      theme: string;
      status: string;
      explanation: string;
      supportingExperiences: string[];
      limitation: string;
    }>;
  } | null;
  personalPositioning: {
    identity: string | null;
    motivations: string[];
    capabilities: string[];
    signatureStrength: string | null;
    theme: string | null;
    intendedDirection: string | null;
    authentic: boolean;
    differentiated: boolean;
    coherent: boolean;
    directionAligned: boolean;
    credible: boolean;
    patternMaturity: string;
    strongestTheme: string | null;
    supportingExperienceTitles: string[];
    evidenceIds: string[];
  } | null;
  proofOfMe: {
    cards: Array<{
      title: string;
      role: string | null;
      personalContribution: string | null;
      outcome: string | null;
      competenciesDemonstrated: string[];
      evidenceStrength: string;
      verificationStatus: string;
    }>;
  } | null;
  overall: {
    confidence: string;
    themes: string[];
    evidenceItemCount: number;
  };
  reflectionFindings: {
    repeated: ReflectionFindingWithStatus[];
    corroborated: ReflectionFindingWithStatus[];
    byKey: Partial<Record<ReflectionAnswerKey, ReflectionFindingWithStatus>>;
  };
  activityEvidence: Array<{
    id: string;
    title: string;
    context: string | null;
    trigger: string | null;
    problem: string | null;
    motivation: string | null;
    challenge: string | null;
    action: string | null;
    ownership: string | null;
    method: string | null;
    impact: string | null;
    transformation: string | null;
    future: string | null;
    role: string | null;
    domainTheme: string | null;
    candidateCapabilitySignals: string[];
    evidenceIds: string[];
  }>;
  canvasDetails: {
    capabilities: Array<{
      rank: number;
      capability: string;
      score: number;
      evidenceIds: string[];
      supportingActivities: string[];
      confidence: string;
      maturity: string;
    }>;
    socialProof: Array<{
      key: string;
      value: number;
      label: string;
      evidenceIds: string[];
    }>;
    growthAreas: Array<{ title: string; gap: string; direction: string; evidenceIds: string[] }>;
    competitiveAdvantages: Array<{ statement: string; evidenceIds: string[] }>;
    positioningDimensions: Record<string, boolean>;
  };
  takeawayFacts: {
    standOut: { identity: SynthesisSectionInput['coreIdentity']; repeatedPattern: SynthesisSectionInput['signaturePattern']; positioning: SynthesisSectionInput['personalPositioning']; evidenceIds: string[] };
    competitiveAdvantage: { capabilities: SynthesisSectionInput['canvasDetails']['capabilities']; socialProof: SynthesisSectionInput['canvasDetails']['socialProof']; positioning: SynthesisSectionInput['personalPositioning']; evidenceIds: string[] };
    growthOpportunity: { gaps: SynthesisSectionInput['canvasDetails']['growthAreas']; intendedDirection: string | null; q5: ReflectionFindingWithStatus | undefined; q6: ReflectionFindingWithStatus | undefined; q7: ReflectionFindingWithStatus | undefined; missingInformation: string[]; evidenceIds: string[] };
  };
  intendedDirection: string | null;
  structuredContractReady: boolean;
};

type ReflectionFindingWithStatus = {
  finding: ReflectionFinding;
  status: 'repeated' | 'isolated';
};

/** Everything the deterministic report already decided, reduced to what the synthesis stage is allowed to see. */
export function synthesisInputFromReport(
  report: PersonalReportV2,
  intendedDirection: string | null,
  options: { evaluationInput?: ProfileEvaluationInput; canvasDetails?: PersonalCanvasDetails } = {},
): SynthesisSectionInput {
  const reflectionFindings = report.reflectionFindings ?? [];
  const signals = options.evaluationInput?.reflectionAnswerSignals ?? [];
  const signalStatus = new Map<ReflectionAnswerKey, 'repeated' | 'isolated'>(
    signals.length > 0
      ? signals.map((signal) => [signal.key, signal.status])
      : Object.entries(report.reflectionFindingStatuses ?? {}) as Array<[ReflectionAnswerKey, 'repeated' | 'isolated']>,
  );
  const activityEvidence = (options.evaluationInput?.narrativeActivities ?? []).map((activity) => ({
    id: activity.id,
    title: activity.title,
    context: activity.narrativeEvidence?.context ?? null,
    trigger: activity.narrativeEvidence?.trigger ?? null,
    problem: activity.narrativeEvidence?.problem ?? null,
    motivation: activity.narrativeEvidence?.motivation ?? null,
    challenge: activity.narrativeEvidence?.challenge ?? null,
    action: activity.narrativeEvidence?.action ?? null,
    ownership: activity.narrativeEvidence?.ownership ?? null,
    method: activity.narrativeEvidence?.method ?? null,
    impact: activity.narrativeEvidence?.impact ?? null,
    transformation: activity.narrativeEvidence?.transformation ?? null,
    future: activity.narrativeEvidence?.future ?? null,
    role: activity.narrativeEvidence?.role ?? null,
    domainTheme: activity.narrativeEvidence?.domainTheme ?? null,
    candidateCapabilitySignals: activity.narrativeEvidence?.candidateCapabilitySignals ?? [],
    evidenceIds: (activity.evidenceRefs ?? []).map((ref) => ref.id),
  }));
  const proofByActivityId = new Map(report.proofOfMe.cards.map((card) => [card.activityId, card]));
  const traitCandidateMap = new Map<string, { characteristic: string; evidenceIds: string[]; activityIds: Set<string> }>();
  for (const card of report.proofOfMe.cards) {
    if (card.evidenceRefs.some((ref) => ref.kind === 'profile_reflection')) continue;
    for (const characteristic of card.competenciesDemonstrated) {
      const key = characteristic.trim().toLowerCase();
      if (!key) continue;
      const current = traitCandidateMap.get(key) ?? { characteristic: characteristic.trim(), evidenceIds: [], activityIds: new Set<string>() };
      current.evidenceIds.push(...card.evidenceRefs.map((ref) => ref.id));
      current.activityIds.add(card.activityId);
      traitCandidateMap.set(key, current);
    }
  }
  const traitCandidates = [...traitCandidateMap.values()]
    .map(({ activityIds, ...candidate }) => ({
      ...candidate,
      evidenceIds: [...new Set(candidate.evidenceIds)],
      scope: activityIds.size >= 2 ? 'repeated' as const : 'emerging' as const,
      confidence: activityIds.size >= 3 ? 'high' as const : activityIds.size >= 2 ? 'medium' as const : 'low' as const,
    }))
    .filter((candidate) => candidate.scope === 'repeated');
  const canvas = options.canvasDetails ?? report.canvasDetails;
  const capabilities = (canvas?.capabilities ?? []).flatMap((capability) => {
    const supportingActivities = capability.supportingEvidence.map((item) => item.title);
    const evidenceIds = capability.supportingEvidence.flatMap((item) =>
      proofByActivityId.get(item.activityId)?.evidenceRefs.map((ref) => ref.id) ?? [],
    );
    if (evidenceIds.length === 0) return [];
    return [{
      rank: capability.score,
      capability: capability.name,
      score: capability.score,
      evidenceIds: [...new Set(evidenceIds)],
      supportingActivities,
      confidence: capability.confidence,
      maturity: capability.band,
    }];
  }).map((capability, index) => ({ ...capability, rank: index + 1 }));
  const socialProof = (canvas?.socialProof ?? []).map((metric) => ({
    key: metric.key,
    value: metric.value,
    label: metric.label,
    evidenceIds: [...new Set(metric.evidenceIds)],
  }));
  const findingsWithStatus = reflectionFindings.map((finding) => ({
    finding,
    status: signalStatus.get(finding.key) ?? 'isolated',
  } satisfies ReflectionFindingWithStatus));
  const repeated = findingsWithStatus.filter(({ status }) => status === 'repeated');
  const corroborated = repeated.filter(({ finding }) => ['q1', 'q2', 'q3'].includes(finding.key));
  const reportReflectionFindings = Object.fromEntries(findingsWithStatus.map((item) => [item.finding.key, item])) as Partial<Record<ReflectionAnswerKey, ReflectionFindingWithStatus>>;
  const supportingExperienceTitles = report.proofOfMe.cards
    .filter((card) => report.coreIdentity.evidenceRefs.some((ref) =>
      ref.id === card.activityId || card.evidenceRefs.some((cardRef) => cardRef.id === ref.id),
    ))
    .map((card) => card.title);
  const growthAreas = (report.growthAreas ?? []).map((area) => ({
    title: area.statement,
    gap: area.currentGap ?? area.statement,
    direction: area.direction ?? '',
    evidenceIds: area.evidenceIds,
  }));
  const standOutEvidenceIds = [...new Set([
    ...report.coreIdentity.evidenceRefs.map((ref) => ref.id),
    ...report.signaturePattern.evidenceRefs.map((ref) => ref.id),
    ...report.emergingThemes.themes.flatMap((theme) => theme.evidenceRefs.map((ref) => ref.id)),
  ])];
  const competitiveEvidenceIds = [...new Set([
    ...report.proofOfMe.cards.flatMap((card) => card.evidenceRefs.map((ref) => ref.id)),
    ...report.personalPositioning.evidenceRefs.map((ref) => ref.id),
    ...socialProof.flatMap((metric) => metric.evidenceIds),
  ])];
  const growthEvidenceIds = [...new Set(growthAreas.flatMap((area) => area.evidenceIds))];
  const missingGrowthInformation = [
    ...(!intendedDirection ? ['intended direction'] : []),
    ...(['q5', 'q6', 'q7'] as const)
      .filter((key) => !reportReflectionFindings[key])
      .map((key) => `Personal Reflection ${key.toUpperCase()}`),
  ];
  return {
    coreIdentity: report.coreIdentity.available
      ? {
          recurringRole: report.coreIdentity.recurringRole,
          recurringBehaviour: report.coreIdentity.recurringBehaviours[0] ?? null,
          valueOrientation: report.coreIdentity.valueOrientation,
          observations: report.coreIdentity.observations,
          recurringBehaviours: report.coreIdentity.recurringBehaviours,
          observedBehaviours: report.coreIdentity.observedBehaviours ?? [],
          corroboratedReflections: corroborated,
          drivingForceStatus: report.drivingForce.isHypothesis ? 'hypothesis' : report.drivingForce.available ? 'confirmed_or_stated' : 'insufficient',
          signaturePattern: report.signaturePattern.steps,
          patternMaturity: report.signaturePattern.patternStrength,
          evidenceIds: report.coreIdentity.evidenceRefs.map((ref) => ref.id),
          traitCandidates,
        }
      : null,
    drivingForce: report.drivingForce.available
      ? {
          statedMotivation: report.drivingForce.repeatedMotivations[0] ?? null,
          isHypothesis: report.drivingForce.isHypothesis,
          repeatedMotivations: report.drivingForce.repeatedMotivations,
          missingPersonalGrounding: report.drivingForce.missingPersonalGrounding,
          reflectionFindings: findingsWithStatus.filter(({ finding }) => ['q1', 'q2', 'q3'].includes(finding.key)),
          cmcaitfMotivations: activityEvidence.map((activity) => activity.motivation).filter((value): value is string => Boolean(value)),
          activityChoices: activityEvidence.map((activity) => activity.title),
          domainThemes: activityEvidence.map((activity) => activity.domainTheme).filter((value): value is string => Boolean(value)),
          actions: activityEvidence.map((activity) => activity.action).filter((value): value is string => Boolean(value)),
          motivationStatus: report.drivingForce.isHypothesis ? 'hypothesis' : report.drivingForce.available ? 'confirmed_or_stated' : 'insufficient',
          evidenceStrength: report.drivingForce.confidence,
          evidenceIds: report.drivingForce.evidenceRefs.map((ref) => ref.id),
        }
      : null,
    signaturePattern: report.signaturePattern.available
      ? {
          patternStrength:
            report.signaturePattern.patternStrength === 'established' ? 'established' : 'emerging',
          steps: report.signaturePattern.steps.map((step) => ({
            key: step.key,
            label: step.label,
            description: step.description,
          })),
        }
      : null,
    emergingThemes: report.emergingThemes.available
      ? {
          themes: report.emergingThemes.themes.map((theme) => ({
            theme: theme.theme,
            status: theme.statusLabel,
            explanation: theme.explanation,
            supportingExperiences: theme.supportingExperiences,
            limitation: theme.limitation,
          })),
        }
      : null,
    personalPositioning: report.personalPositioning.available
      ? {
          identity: report.coreIdentity.recurringBehaviours[0] ?? report.coreIdentity.recurringRole,
          motivations: report.drivingForce.repeatedMotivations,
          capabilities: Array.from(
            new Set(report.proofOfMe.cards.flatMap((card) => card.competenciesDemonstrated)),
          ),
          signatureStrength: report.signaturePattern.available
            ? report.signaturePattern.steps.find((step) => step.key === 'method')?.description ?? null
            : null,
          theme: report.emergingThemes.themes[0]?.theme ?? null,
          intendedDirection,
          authentic: report.personalPositioning.authentic,
          differentiated: report.personalPositioning.differentiated,
          coherent: report.personalPositioning.coherent,
          directionAligned: report.personalPositioning.directionAligned,
          credible: report.personalPositioning.credible,
          patternMaturity: report.signaturePattern.patternStrength,
          strongestTheme: report.emergingThemes.themes[0]?.theme ?? null,
          supportingExperienceTitles,
          evidenceIds: report.personalPositioning.evidenceRefs.map((ref) => ref.id),
        }
      : null,
    proofOfMe: report.proofOfMe.available
      ? {
          cards: report.proofOfMe.cards.map((card) => ({
            title: card.title,
            role: card.role,
            personalContribution: card.personalContribution,
            outcome: card.outcome,
            competenciesDemonstrated: card.competenciesDemonstrated,
            evidenceStrength: card.evidenceStrength,
            verificationStatus: card.verificationStatus,
          })),
        }
      : null,
    overall: {
      confidence: report.overallEvidenceConfidence,
      themes: report.emergingThemes.themes.map((theme) => theme.theme),
      evidenceItemCount: report.proofOfMe.cards.length,
    },
    reflectionFindings: { repeated, corroborated, byKey: reportReflectionFindings },
    activityEvidence,
    canvasDetails: {
      capabilities,
      socialProof,
      growthAreas,
      competitiveAdvantages: (report.competitiveAdvantages ?? []).map((advantage) => ({
        statement: advantage.statement,
        evidenceIds: advantage.evidenceIds,
      })),
      positioningDimensions: {
        authenticity: report.personalPositioning.authentic,
        differentiation: report.personalPositioning.differentiated,
        coherence: report.personalPositioning.coherent,
        directionAlignment: report.personalPositioning.directionAligned,
        credibility: report.personalPositioning.credible,
      },
    },
    takeawayFacts: {
      standOut: { identity: report.coreIdentity.available ? {
        recurringRole: report.coreIdentity.recurringRole,
        recurringBehaviour: report.coreIdentity.recurringBehaviours[0] ?? null,
        valueOrientation: report.coreIdentity.valueOrientation,
        observations: report.coreIdentity.observations,
        recurringBehaviours: report.coreIdentity.recurringBehaviours,
        observedBehaviours: report.coreIdentity.observedBehaviours ?? [],
        corroboratedReflections: corroborated,
        drivingForceStatus: report.drivingForce.isHypothesis ? 'hypothesis' : report.drivingForce.available ? 'confirmed_or_stated' : 'insufficient',
        signaturePattern: report.signaturePattern.steps,
        patternMaturity: report.signaturePattern.patternStrength,
        evidenceIds: report.coreIdentity.evidenceRefs.map((ref) => ref.id),
        traitCandidates,
      } : null, repeatedPattern: report.signaturePattern.available ? {
        patternStrength: report.signaturePattern.patternStrength === 'established' ? 'established' : 'emerging',
        steps: report.signaturePattern.steps,
      } : null, positioning: null, evidenceIds: standOutEvidenceIds },
      competitiveAdvantage: { capabilities, socialProof, positioning: report.personalPositioning.available ? {
        identity: report.coreIdentity.recurringBehaviours[0] ?? report.coreIdentity.recurringRole,
        motivations: report.drivingForce.repeatedMotivations,
        capabilities: Array.from(new Set(report.proofOfMe.cards.flatMap((card) => card.competenciesDemonstrated))),
        signatureStrength: report.signaturePattern.steps.find((step) => step.key === 'method')?.description ?? null,
        theme: report.emergingThemes.themes[0]?.theme ?? null,
        intendedDirection,
        authentic: report.personalPositioning.authentic,
        differentiated: report.personalPositioning.differentiated,
        coherent: report.personalPositioning.coherent,
        directionAligned: report.personalPositioning.directionAligned,
        credible: report.personalPositioning.credible,
        patternMaturity: report.signaturePattern.patternStrength,
        strongestTheme: report.emergingThemes.themes[0]?.theme ?? null,
        supportingExperienceTitles,
        evidenceIds: report.personalPositioning.evidenceRefs.map((ref) => ref.id),
      } : null, evidenceIds: competitiveEvidenceIds },
      growthOpportunity: {
        gaps: growthAreas,
        intendedDirection,
        q5: reportReflectionFindings.q5,
        q6: reportReflectionFindings.q6,
        q7: reportReflectionFindings.q7,
        missingInformation: missingGrowthInformation,
        evidenceIds: growthEvidenceIds,
      },
    },
    intendedDirection,
    structuredContractReady: report.reflectionFindings !== undefined || report.canvasDetails !== undefined,
  };
}

/** Every evidence id this report actually has — the only ids the model is allowed to cite. */
export function allowedEvidenceIdsFor(report: PersonalReportV2): Map<string, EvidenceRef> {
  const all: EvidenceRef[] = [
    ...report.coreIdentity.evidenceRefs,
    ...report.drivingForce.evidenceRefs,
    ...report.signaturePattern.evidenceRefs,
    ...report.emergingThemes.themes.flatMap((theme) => theme.evidenceRefs),
    ...report.personalPositioning.evidenceRefs,
    ...report.proofOfMe.cards.flatMap((card) => card.evidenceRefs),
  ];
  return new Map(all.map((ref) => [ref.id, ref]));
}

function evidenceMap(refs: readonly EvidenceRef[]): Map<string, EvidenceRef> {
  return new Map(refs.map((ref) => [ref.id, ref]));
}

function allowedEvidenceIdsBySection(report: PersonalReportV2, sectionInput?: SynthesisSectionInput) {
  const all = allowedEvidenceIdsFor(report);
  const proofIds = report.proofOfMe.cards.flatMap((card) => card.evidenceRefs);
  const coreIdentityNarrative = [...report.coreIdentity.evidenceRefs, ...report.signaturePattern.evidenceRefs];
  const positioningNarrative = [
    ...report.coreIdentity.evidenceRefs,
    ...report.signaturePattern.evidenceRefs,
    ...report.emergingThemes.themes.flatMap((theme) => theme.evidenceRefs),
    ...proofIds,
  ];
  const socialProofNarrative = (sectionInput?.canvasDetails.socialProof ?? []).flatMap((metric) =>
    metric.evidenceIds.map((id) => all.get(id)).filter((ref): ref is EvidenceRef => Boolean(ref)),
  );
  const refsForIds = (ids: readonly string[]) => ids.map((id) => all.get(id)).filter((ref): ref is EvidenceRef => Boolean(ref));
  const keyTakeaways = report.keyTakeaways;
  const standOutIds = [
    ...(keyTakeaways?.whatMakesYouStandOut.evidenceIds ?? []),
    ...report.coreIdentity.evidenceRefs.map((ref) => ref.id),
    ...report.signaturePattern.evidenceRefs.map((ref) => ref.id),
    ...report.emergingThemes.themes.flatMap((theme) => theme.evidenceRefs.map((ref) => ref.id)),
  ];
  const competitiveIds = [
    ...(keyTakeaways?.competitiveAdvantage.evidenceIds ?? []),
    ...proofIds.map((ref) => ref.id),
    ...report.personalPositioning.evidenceRefs.map((ref) => ref.id),
    ...(sectionInput?.canvasDetails.socialProof ?? []).flatMap((metric) => metric.evidenceIds),
  ];
  const growthIds = [
    ...(keyTakeaways?.growthOpportunity.evidenceIds ?? []),
    ...(report.growthAreas ?? []).flatMap((item) => item.evidenceIds),
    ...report.drivingForce.evidenceRefs.map((ref) => ref.id),
    ...report.personalPositioning.evidenceRefs.map((ref) => ref.id),
  ];
  return {
    coreIdentity: evidenceMap(report.coreIdentity.evidenceRefs),
    drivingForce: evidenceMap(report.drivingForce.evidenceRefs),
    signaturePattern: evidenceMap(report.signaturePattern.evidenceRefs),
    emergingThemes: evidenceMap(report.emergingThemes.themes.flatMap((theme) => theme.evidenceRefs)),
    personalPositioning: evidenceMap(report.personalPositioning.evidenceRefs),
    proofOfMe: evidenceMap(report.proofOfMe.cards.flatMap((card) => card.evidenceRefs)),
    narrativeCoreIdentity: evidenceMap(coreIdentityNarrative),
    narrativeDrivingForce: evidenceMap(report.drivingForce.evidenceRefs),
    narrativeCapabilities: evidenceMap(proofIds),
    narrativeSocialProof: evidenceMap(socialProofNarrative),
    narrativePositioning: evidenceMap(positioningNarrative),
    narrativeKeyTakeaways: {
      standOut: evidenceMap(refsForIds(standOutIds)),
      competitiveAdvantage: evidenceMap(refsForIds(competitiveIds)),
      growthOpportunity: evidenceMap(refsForIds(growthIds)),
    },
  };
}

function narrativeNumbers(value: string): string[] {
  return value.match(/\d+(?:[.,]\d+)?/g) ?? [];
}

function groundedNumbers(value: unknown, key = ''): string[] {
  if (/(?:evidenceIds?|metricKeys|sourceActivityIds|rank|score)$/i.test(key)) return [];
  if (typeof value === 'number') return [String(value)];
  if (typeof value === 'string') return narrativeNumbers(value);
  if (Array.isArray(value)) return value.flatMap((item) => groundedNumbers(item, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => groundedNumbers(child, childKey));
  }
  return [];
}

function proseStrings(value: unknown, key = ''): string[] {
  if (/(?:evidenceIds?|metricKeys|sourceActivityIds)$/i.test(key)) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => proseStrings(item, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => proseStrings(child, childKey));
  }
  return [];
}

function narrativeDetailsProse(details: ParsedNarrativeDetails | null | undefined): string[] {
  if (!details) return [];
  const prose: string[] = [];
  if (details.snapshot) prose.push(details.snapshot);
  if (details.coreIdentity) {
    prose.push(details.coreIdentity.identityStatement, ...details.coreIdentity.definingTraits.flatMap((trait) => [trait.characteristic, trait.insight, trait.whyItMatters]));
  }
  if (details.drivingForce) {
    prose.push(
      details.drivingForce.primaryMotivation,
      ...details.drivingForce.repeatedChoices,
      ...details.drivingForce.recurringProblems,
      ...details.drivingForce.underlyingValues,
      details.drivingForce.strategicInterpretation,
    );
  }
  if (details.provenCapabilities) {
    prose.push(
      details.provenCapabilities.overview,
      details.provenCapabilities.combinationInsight,
      ...details.provenCapabilities.capabilities.flatMap((capability) => [
        capability.capability,
        capability.howDemonstrated,
        capability.whyItMatters,
        ...capability.supportingActivities,
      ]),
    );
  }
  if (details.socialProof) prose.push(details.socialProof.conclusion);
  if (details.profilePositioning) {
    prose.push(
      details.profilePositioning.experienceConnection.strongestProfileThread,
      details.profilePositioning.experienceConnection.connectionExplanation,
      details.profilePositioning.profileNarrative,
      ...details.profilePositioning.positioningOptions.flatMap((option) => [option.title, option.statement, ...option.supportingExperienceTitles]),
    );
  }
  if (details.keyTakeaways) {
    prose.push(
      details.keyTakeaways.whatMakesYouStandOut.title,
      details.keyTakeaways.whatMakesYouStandOut.insight,
      details.keyTakeaways.whatMakesYouStandOut.evidencePattern,
      details.keyTakeaways.whatMakesYouStandOut.whyItMatters,
      details.keyTakeaways.competitiveAdvantage.title,
      details.keyTakeaways.competitiveAdvantage.advantageStatement,
      details.keyTakeaways.competitiveAdvantage.supportingEvidence,
      details.keyTakeaways.competitiveAdvantage.applicationRelevance,
      details.keyTakeaways.growthOpportunity.title,
      details.keyTakeaways.growthOpportunity.growthArea,
      details.keyTakeaways.growthOpportunity.currentGap,
      details.keyTakeaways.growthOpportunity.recommendedDirection,
      details.keyTakeaways.growthOpportunity.whyItMatters,
    );
  }
  return prose;
}

/** Rejects a prose response that introduces a numeric fact absent from the
 * deterministic section findings (e.g. an invented team size or outcome). */
function assertNarrativeNumbersAreGrounded(
  parsed: z.infer<typeof synthesisResponseSchema>,
  sectionInput: SynthesisSectionInput,
): void {
  const inputNumbers = (value: unknown) => new Set(groundedNumbers(value));
  const allGroundedNumbers = inputNumbers(sectionInput);
  const details = parsed.narrativeDetails;
  const sections: Array<[string, string[], Set<string>]> = [
    ['snapshot', details?.snapshot ? [details.snapshot] : [], inputNumbers({
      coreIdentity: sectionInput.coreIdentity,
      drivingForce: sectionInput.drivingForce,
      personalPositioning: sectionInput.personalPositioning,
      activityEvidence: sectionInput.activityEvidence,
    })],
    ['coreIdentity', details?.coreIdentity ? proseStrings(details.coreIdentity) : [], inputNumbers({
      coreIdentity: sectionInput.coreIdentity,
      signaturePattern: sectionInput.signaturePattern,
    })],
    ['drivingForce', details?.drivingForce ? proseStrings(details.drivingForce) : [], inputNumbers(sectionInput.drivingForce)],
    ['provenCapabilities', details?.provenCapabilities ? proseStrings(details.provenCapabilities) : [], inputNumbers({
      capabilities: sectionInput.canvasDetails.capabilities,
      activityEvidence: sectionInput.activityEvidence,
    })],
    ['socialProof', details?.socialProof ? proseStrings(details.socialProof) : [], inputNumbers(sectionInput.canvasDetails.socialProof)],
    ['profilePositioning', details?.profilePositioning ? proseStrings(details.profilePositioning) : [], inputNumbers({
      personalPositioning: sectionInput.personalPositioning,
      activityCount: sectionInput.activityEvidence.length,
    })],
    ['standOut', details?.keyTakeaways ? proseStrings(details.keyTakeaways.whatMakesYouStandOut) : [], inputNumbers({
      coreIdentity: sectionInput.coreIdentity,
      signaturePattern: sectionInput.signaturePattern,
      emergingThemes: sectionInput.emergingThemes,
    })],
    ['competitiveAdvantage', details?.keyTakeaways ? proseStrings(details.keyTakeaways.competitiveAdvantage) : [], inputNumbers({
      capabilities: sectionInput.canvasDetails.capabilities,
      socialProof: sectionInput.canvasDetails.socialProof,
      personalPositioning: sectionInput.personalPositioning,
    })],
    ['growthOpportunity', details?.keyTakeaways ? proseStrings(details.keyTakeaways.growthOpportunity) : [], inputNumbers({
      growthAreas: sectionInput.canvasDetails.growthAreas,
      personalPositioning: sectionInput.personalPositioning,
      q5: sectionInput.reflectionFindings.byKey.q5,
      q6: sectionInput.reflectionFindings.byKey.q6,
      q7: sectionInput.reflectionFindings.byKey.q7,
    })],
  ];
  for (const [section, prose, allowed] of sections) {
    if (prose.some((value) => narrativeNumbers(value).some((number) => !allowed.has(number) && !allGroundedNumbers.has(number)))) {
      throw new Error(`Narrative synthesis introduced an unsupported numeric fact in ${section}.`);
    }
  }
}

function assertNarrativeVoice(parsed: z.infer<typeof synthesisResponseSchema>): void {
  const prose = narrativeDetailsProse(parsed.narrativeDetails);
  const firstPerson = /(?:^|[\s(])(?:i(?:['’](?:m|ve|d|ll))?|me|my|mine|we(?:['’](?:re|ve))?|our|ours|us|tôi|mình|chúng tôi|của tôi)(?=$|[\s,.;:!?])/iu;
  if (prose.some((value) => firstPerson.test(value))) {
    throw new Error('Narrative synthesis used first-person voice.');
  }
  const applicantVoice = /\b(?:you|your|yours)\b/gi;
  const applicantMentions = prose.reduce((count, value) => count + (value.match(applicantVoice)?.length ?? 0), 0);
  const thirdPersonMentions = prose.reduce((count, value) => count + (value.match(/\b(?:the applicant|the candidate|this applicant|this candidate)\b/gi)?.length ?? 0), 0);
  if (parsed.narrativeDetails && applicantMentions === 0 && thirdPersonMentions >= 2) throw new Error('Narrative synthesis used dominated third-person voice.');
}

function assertReportMechanicsProse(parsed: z.infer<typeof synthesisResponseSchema>): void {
  const mechanics = /\b(?:this|the) report\b|\breporting system\b|\bevidence framework\b|\bconfirmed snapshot\b|\bgeneration process\b|\bverification methodology\b/i;
  if (narrativeDetailsProse(parsed.narrativeDetails).some((value) => mechanics.test(value))) {
    throw new Error('Narrative synthesis used report mechanics prose.');
  }
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function assertWordRange(value: string, min: number, max: number, section: string): void {
  const count = wordCount(value);
  if (count < min || count > max) throw new Error(`${section} word length is outside the required range.`);
}

function assertNarrativeDetailsLengths(details: NonNullable<z.infer<typeof synthesisResponseSchema>['narrativeDetails']>): void {
  if (details.snapshot) assertWordRange(details.snapshot, 150, 200, 'Snapshot');
  if (details.coreIdentity) assertWordRange(details.coreIdentity.identityStatement, 80, 120, 'Core Identity');
  if (details.provenCapabilities) assertWordRange(details.provenCapabilities.overview, 100, 120, 'Capability Overview');
  if (details.profilePositioning) assertWordRange(details.profilePositioning.profileNarrative, 100, 130, 'Profile Narrative');
}

function assertHypothesisLanguage(
  parsed: z.infer<typeof synthesisResponseSchema>,
  sectionInput: SynthesisSectionInput,
): void {
  if (!sectionInput.drivingForce?.isHypothesis || !parsed.narrativeDetails?.drivingForce) return;
  const prose = [
    parsed.narrativeDetails.drivingForce.primaryMotivation,
    parsed.narrativeDetails.drivingForce.strategicInterpretation,
  ].join(' ');
  if (!/\b(emerging|hypothesis|appears|suggests|may|could|possible|not yet confirmed)\b/i.test(prose)) {
    throw new Error('Narrative synthesis promoted a hypothesis to fact.');
  }
}

function normalizeEmptyOptionalSections(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return { ...value };
}

function failureCode(error: unknown): PersonalReportNarrativeFailureCode {
  if (error instanceof SyntaxError) return 'invalid_json';
  if (error instanceof z.ZodError) {
    return error.issues.some((issue) => issue.path.join('.') === 'narrativeDetails.snapshot')
      ? 'schema_snapshot_summary'
      : 'schema_response';
  }
  const message = error instanceof Error ? error.message : '';
  if (/cover every available report section/i.test(message)) return 'missing_sections';
  if (/cited evidence outside its section/i.test(message)) return 'invalid_evidence_scope';
  if (/promoted a hypothesis/i.test(message)) return 'hypothesis_promotion';
  if (/report mechanics prose/i.test(message)) return 'report_mechanics_prose';
  if (/unsupported capability|unsupported social-proof metric/i.test(message)) return 'unsupported_narrative_fact';
  if (/unsupported numeric fact/i.test(message)) return 'unsupported_narrative_fact';
  if (/word length/i.test(message)) return 'invalid_word_length';
  if (/first-person voice|dominated third-person voice/i.test(message)) return 'unsupported_narrative_voice';
  if (/exceeded the token limit/i.test(message)) return 'output_truncated';
  if (/request timed out/i.test(message)) return 'timeout';
  if (/OpenAI request failed/i.test(message)) return 'provider_error';
  return 'unknown';
}

type CanonicalNarrativeSection =
  | 'coreIdentity'
  | 'drivingForce'
  | 'signaturePattern'
  | 'emergingThemes'
  | 'personalPositioning'
  | 'proofOfMe';
type StructuredNarrativeSection =
  | 'snapshot'
  | 'coreIdentity'
  | 'drivingForce'
  | 'provenCapabilities'
  | 'socialProof'
  | 'profilePositioning'
  | 'keyTakeaways';
type OptionalNarrativeSection = 'snapshot' | 'overview' | 'overallSummary';
type NarrativeBatch = {
  canonical: readonly CanonicalNarrativeSection[];
  structured: readonly StructuredNarrativeSection[];
  optional: readonly OptionalNarrativeSection[];
  maxTokens: number;
  required: boolean;
};

// Two concise calls keep the report within the worker runtime budget. Each
// receives only the sections it must write; no raw evidence is duplicated.
const NARRATIVE_BATCHES: readonly NarrativeBatch[] = [
  {
    canonical: [],
    structured: ['snapshot', 'coreIdentity', 'drivingForce', 'profilePositioning'],
    optional: [],
    maxTokens: 3_000,
    required: true,
  },
  {
    canonical: [],
    structured: ['provenCapabilities', 'socialProof', 'keyTakeaways'],
    optional: [],
    maxTokens: 3_000,
    required: true,
  },
];

function batchInput(
  sectionInput: SynthesisSectionInput,
  batch: NarrativeBatch,
): SynthesisSectionInput {
  const requested = new Set(batch.canonical);
  const structured = new Set(batch.structured);
  const wantsSnapshot = structured.has('snapshot');
  const wantsCore = requested.has('coreIdentity') || structured.has('coreIdentity') || wantsSnapshot || structured.has('keyTakeaways');
  const wantsDriving = requested.has('drivingForce') || structured.has('drivingForce') || wantsSnapshot || structured.has('profilePositioning');
  const wantsPattern = requested.has('signaturePattern') || structured.has('profilePositioning') || structured.has('keyTakeaways') || wantsSnapshot;
  const wantsThemes = requested.has('emergingThemes') || structured.has('profilePositioning') || structured.has('keyTakeaways') || wantsSnapshot;
  const wantsPositioning = requested.has('personalPositioning') || structured.has('profilePositioning') || structured.has('keyTakeaways') || wantsSnapshot;
  const wantsProof = requested.has('proofOfMe') || structured.has('provenCapabilities') || structured.has('keyTakeaways') || wantsSnapshot;
  const reflectionKeys = new Set<ReflectionAnswerKey>(
    batch === NARRATIVE_BATCHES[0] ? ['q1', 'q2', 'q3', 'q5', 'q6'] : ['q4', 'q5', 'q6', 'q7'],
  );
  const byKey = Object.fromEntries(
    Object.entries(sectionInput.reflectionFindings.byKey)
      .filter(([key]) => reflectionKeys.has(key as ReflectionAnswerKey))
      .map(([key, item]) => [key, item]),
  ) as Partial<Record<ReflectionAnswerKey, ReflectionFindingWithStatus>>;
  const reflectionFindings = {
    repeated: sectionInput.reflectionFindings.repeated.filter(({ finding }) => reflectionKeys.has(finding.key)),
    corroborated: sectionInput.reflectionFindings.corroborated.filter(({ finding }) => reflectionKeys.has(finding.key)),
    byKey,
  };
  const activityEvidence = sectionInput.activityEvidence.map((activity) => ({
    ...activity,
    context: wantsCore || structured.has('profilePositioning') ? activity.context : null,
    trigger: wantsCore || structured.has('profilePositioning') ? activity.trigger : null,
    problem: wantsDriving || structured.has('profilePositioning') ? activity.problem : null,
    motivation: wantsDriving || structured.has('profilePositioning') ? activity.motivation : null,
    challenge: wantsDriving || structured.has('profilePositioning') ? activity.challenge : null,
    action: wantsDriving || structured.has('provenCapabilities') || structured.has('keyTakeaways') ? activity.action : null,
    ownership: wantsCore || structured.has('provenCapabilities') || structured.has('profilePositioning') ? activity.ownership : null,
    method: wantsCore || structured.has('provenCapabilities') || structured.has('profilePositioning') ? activity.method : null,
    impact: structured.has('provenCapabilities') || structured.has('keyTakeaways') ? activity.impact : null,
    transformation: structured.has('provenCapabilities') || structured.has('keyTakeaways') ? activity.transformation : null,
    future: structured.has('profilePositioning') || structured.has('keyTakeaways') ? activity.future : null,
    role: wantsCore || structured.has('provenCapabilities') || structured.has('profilePositioning') || structured.has('keyTakeaways') ? activity.role : null,
    domainTheme: wantsThemes || structured.has('provenCapabilities') ? activity.domainTheme : null,
    candidateCapabilitySignals: structured.has('provenCapabilities') || structured.has('keyTakeaways') ? activity.candidateCapabilitySignals : [],
  }));
  const canvasDetails = {
    capabilities: structured.has('provenCapabilities') || wantsSnapshot || structured.has('keyTakeaways') ? sectionInput.canvasDetails.capabilities : [],
    socialProof: structured.has('socialProof') || wantsSnapshot || structured.has('keyTakeaways') ? sectionInput.canvasDetails.socialProof : [],
    growthAreas: structured.has('keyTakeaways') || wantsSnapshot ? sectionInput.canvasDetails.growthAreas : [],
    competitiveAdvantages: structured.has('keyTakeaways') ? sectionInput.canvasDetails.competitiveAdvantages : [],
    positioningDimensions: wantsPositioning ? sectionInput.canvasDetails.positioningDimensions : {},
  };
  return {
    coreIdentity: wantsCore ? sectionInput.coreIdentity : null,
    drivingForce: wantsDriving ? sectionInput.drivingForce : null,
    signaturePattern: wantsPattern ? sectionInput.signaturePattern : null,
    emergingThemes: wantsThemes ? sectionInput.emergingThemes : null,
    personalPositioning: wantsPositioning ? sectionInput.personalPositioning : null,
    proofOfMe: wantsProof ? sectionInput.proofOfMe : null,
    overall: sectionInput.overall,
    reflectionFindings,
    activityEvidence,
    canvasDetails,
    takeawayFacts: structured.has('keyTakeaways') || wantsSnapshot ? sectionInput.takeawayFacts : {
      standOut: { identity: null, repeatedPattern: null, positioning: null, evidenceIds: [] },
      competitiveAdvantage: { capabilities: [], socialProof: [], positioning: null, evidenceIds: [] },
      growthOpportunity: { gaps: [], intendedDirection: null, q5: undefined, q6: undefined, q7: undefined, missingInformation: [], evidenceIds: [] },
    },
    intendedDirection: structured.has('profilePositioning') || structured.has('keyTakeaways') || wantsSnapshot ? sectionInput.intendedDirection : null,
    structuredContractReady: sectionInput.structuredContractReady,
  };
}

const STRUCTURED_DETAIL_KEYS: readonly StructuredNarrativeSection[] = [
  'snapshot',
  'coreIdentity',
  'drivingForce',
  'provenCapabilities',
  'socialProof',
  'profilePositioning',
  'keyTakeaways',
];

function assertNarrativeDetailsRouting(
  details: ParsedNarrativeDetails,
  batch: NarrativeBatch,
): void {
  const requested = new Set(batch.structured);
  if (STRUCTURED_DETAIL_KEYS.some((key) => details[key] != null && !requested.has(key))) {
    throw new Error('Narrative synthesis returned a section outside its batch.');
  }
}

function structuredSectionAvailable(key: StructuredNarrativeSection, input: SynthesisSectionInput): boolean {
  if (key === 'snapshot') return Boolean(input.coreIdentity || input.drivingForce || input.personalPositioning);
  if (key === 'coreIdentity') return Boolean(input.coreIdentity);
  if (key === 'drivingForce') return Boolean(input.drivingForce);
  if (key === 'profilePositioning') return Boolean(input.personalPositioning);
  if (key === 'provenCapabilities') return input.canvasDetails.capabilities.length > 0;
  if (key === 'socialProof') return input.canvasDetails.socialProof.some((metric) => metric.value > 0 && metric.evidenceIds.length > 0);
  return Boolean(
    input.takeawayFacts.standOut.evidenceIds.length ||
    input.takeawayFacts.competitiveAdvantage.evidenceIds.length ||
    input.takeawayFacts.growthOpportunity.gaps.length,
  );
}

function batchAllowedEvidenceIds(
  batch: NarrativeBatch,
  allowed: ReadonlyMap<string, EvidenceRef>,
  allowedBySection: ReturnType<typeof allowedEvidenceIdsBySection>,
) {
  const structuredRequested = new Set(batch.structured);
  return {
    all: [...allowed.keys()],
    narrativeDetails: {
      coreIdentity: structuredRequested.has('coreIdentity') ? [...allowedBySection.narrativeCoreIdentity.keys()] : [],
      drivingForce: structuredRequested.has('drivingForce') ? [...allowedBySection.narrativeDrivingForce.keys()] : [],
      provenCapabilities: structuredRequested.has('provenCapabilities') ? [...allowedBySection.narrativeCapabilities.keys()] : [],
      socialProof: structuredRequested.has('socialProof') ? [...allowedBySection.narrativeSocialProof.keys()] : [],
      profilePositioning: structuredRequested.has('profilePositioning') ? [...allowedBySection.narrativePositioning.keys()] : [],
      keyTakeaways: structuredRequested.has('keyTakeaways')
        ? {
            standOut: [...allowedBySection.narrativeKeyTakeaways.standOut.keys()],
            competitiveAdvantage: [...allowedBySection.narrativeKeyTakeaways.competitiveAdvantage.keys()],
            growthOpportunity: [...allowedBySection.narrativeKeyTakeaways.growthOpportunity.keys()],
          }
        : { standOut: [], competitiveAdvantage: [], growthOpportunity: [] },
    },
  };
}

function batchInputForModel(
  sectionInput: SynthesisSectionInput,
  batch: NarrativeBatch,
): SynthesisSectionInput {
  const input = batchInput(sectionInput, batch);
  if (!input.drivingForce) return input;

  return {
    ...input,
    drivingForce: {
      ...input.drivingForce,
      evidenceStrength: input.drivingForce.evidenceStrength === 'high'
        ? 'strong'
        : input.drivingForce.evidenceStrength === 'medium'
          ? 'moderate'
          : 'limited',
    },
  };
}

type ParsedNarrativeDetails = NonNullable<z.infer<typeof synthesisResponseSchema>['narrativeDetails']>;

function requireEvidenceIds(ids: readonly string[], allowed: ReadonlyMap<string, EvidenceRef>): string[] {
  const invalid = ids.find((id) => !allowed.has(id));
  if (invalid) throw new Error('Narrative synthesis cited evidence outside its section.');
  return [...ids];
}

function requireSubset(ids: readonly string[], allowed: ReadonlySet<string>): string[] {
  const invalid = ids.find((id) => !allowed.has(id));
  if (invalid) throw new Error('Narrative synthesis cited evidence outside its section.');
  return [...ids];
}

function normalizeNarrativeLabel(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ');
}

function materializeNarrativeDetails(
  details: ParsedNarrativeDetails,
  batch: NarrativeBatch,
  sectionInput: SynthesisSectionInput,
  allowedBySection: ReturnType<typeof allowedEvidenceIdsBySection>,
): PersonalReportNarrativeDetails {
  const output: PersonalReportNarrativeDetails = {};
  const requested = new Set(batch.structured);
  if (requested.has('snapshot') && details.snapshot) {
    assertWordRange(details.snapshot, 150, 200, 'Snapshot');
    output.snapshot = details.snapshot;
  }
  if (requested.has('coreIdentity') && details.coreIdentity) {
    const candidateTraits = new Map(
      sectionInput.coreIdentity?.traitCandidates.map((candidate) => [candidate.characteristic.toLowerCase(), candidate]) ?? [],
    );
    output.coreIdentity = {
      identityStatement: details.coreIdentity.identityStatement,
      evidenceIds: requireEvidenceIds(details.coreIdentity.evidenceIds, allowedBySection.narrativeCoreIdentity),
      definingTraits: details.coreIdentity.definingTraits.map((trait) => {
        const candidate = candidateTraits.get(trait.characteristic.toLowerCase());
        if (!candidate) throw new Error('Narrative synthesis cited an unsupported defining trait.');
        return {
          ...trait,
          evidenceIds: requireSubset(trait.evidenceIds, new Set(candidate.evidenceIds)),
          scope: candidate.scope,
          confidence: candidate.confidence,
        };
      }),
    };
  }
  if (requested.has('drivingForce') && details.drivingForce) {
    if (sectionInput.drivingForce && details.drivingForce.isHypothesis !== sectionInput.drivingForce.isHypothesis) {
      throw new Error('Narrative synthesis promoted a hypothesis to fact.');
    }
    output.drivingForce = {
      ...details.drivingForce,
      evidenceIds: requireEvidenceIds(details.drivingForce.evidenceIds, allowedBySection.narrativeDrivingForce),
      evidenceStrength: sectionInput.drivingForce?.evidenceStrength === 'high'
        ? 'strong'
        : sectionInput.drivingForce?.evidenceStrength === 'medium'
          ? 'moderate'
          : 'limited',
      isHypothesis: sectionInput.drivingForce?.isHypothesis ?? details.drivingForce.isHypothesis,
    };
  }
  if (requested.has('provenCapabilities') && details.provenCapabilities) {
    const canonical = new Map(sectionInput.canvasDetails.capabilities.slice(0, 4).map((capability) => [normalizeNarrativeLabel(capability.capability), capability]));
    output.provenCapabilities = {
      overview: details.provenCapabilities.overview,
      overviewEvidenceIds: requireEvidenceIds(details.provenCapabilities.overviewEvidenceIds, allowedBySection.narrativeCapabilities),
      capabilities: details.provenCapabilities.capabilities.flatMap((capability) => {
        const match = canonical.get(normalizeNarrativeLabel(capability.capability));
        if (!match) return [];
        return {
          ...capability,
          evidenceIds: requireSubset(capability.evidenceIds, new Set(match.evidenceIds)),
          supportingActivities: requireSubset(capability.supportingActivities, new Set(match.supportingActivities)),
        };
      }),
      combinationInsight: details.provenCapabilities.combinationInsight,
      combinationEvidenceIds: requireEvidenceIds(details.provenCapabilities.combinationEvidenceIds, allowedBySection.narrativeCapabilities),
    };
  }
  if (requested.has('socialProof') && details.socialProof) {
    const metricKeys = new Set(sectionInput.canvasDetails.socialProof.map((metric) => metric.key));
    output.socialProof = {
      ...details.socialProof,
      metricKeys: details.socialProof.metricKeys.filter((key) => metricKeys.has(key)),
      evidenceIds: requireEvidenceIds(details.socialProof.evidenceIds, allowedBySection.narrativeSocialProof),
    };
  }
  if (requested.has('profilePositioning') && details.profilePositioning) {
    const supportingExperienceTitles = sectionInput.personalPositioning?.supportingExperienceTitles ?? [];
    output.profilePositioning = {
      experienceConnection: {
        ...details.profilePositioning.experienceConnection,
        supportingExperienceCount: supportingExperienceTitles.length,
        supportingExperienceTitles,
        evidenceIds: requireEvidenceIds(details.profilePositioning.experienceConnection.evidenceIds, allowedBySection.narrativePositioning),
      },
      positioningOptions: details.profilePositioning.positioningOptions.map((option) => ({
        ...option,
        supportingEvidenceIds: requireEvidenceIds(option.supportingEvidenceIds, allowedBySection.narrativePositioning),
        supportingExperienceTitles: requireSubset(option.supportingExperienceTitles, new Set(sectionInput.activityEvidence.map((activity) => activity.title))),
      })),
      profileNarrative: details.profilePositioning.profileNarrative,
      profileNarrativeEvidenceIds: requireEvidenceIds(details.profilePositioning.profileNarrativeEvidenceIds, allowedBySection.narrativePositioning),
    };
  }
  if (requested.has('keyTakeaways') && details.keyTakeaways) {
    const growth = details.keyTakeaways.growthOpportunity;
    if ((growth.basis === 'missing_information') !== (growth.evidenceIds.length === 0)) {
      throw new Error('Narrative synthesis used an invalid growth evidence basis.');
    }
    output.keyTakeaways = {
      whatMakesYouStandOut: {
        ...details.keyTakeaways.whatMakesYouStandOut,
        evidenceIds: requireEvidenceIds(details.keyTakeaways.whatMakesYouStandOut.evidenceIds, allowedBySection.narrativeKeyTakeaways.standOut),
      },
      competitiveAdvantage: {
        ...details.keyTakeaways.competitiveAdvantage,
        evidenceIds: requireEvidenceIds(details.keyTakeaways.competitiveAdvantage.evidenceIds, allowedBySection.narrativeKeyTakeaways.competitiveAdvantage),
      },
      growthOpportunity: {
        ...growth,
        evidenceIds: requireEvidenceIds(growth.evidenceIds, allowedBySection.narrativeKeyTakeaways.growthOpportunity),
      },
    };
  }
  return output;
}

function materializeBatch(
  parsed: z.infer<typeof synthesisResponseSchema>,
  batch: NarrativeBatch,
  sectionInput: SynthesisSectionInput,
  allowedBySection: ReturnType<typeof allowedEvidenceIdsBySection>,
): Partial<PersonalReportNarrativeSynthesis> {
  const result: Partial<PersonalReportNarrativeSynthesis> = {};
  if (parsed.narrativeDetails) {
    result.narrativeDetails = materializeNarrativeDetails(parsed.narrativeDetails, batch, sectionInput, allowedBySection);
  }

  return result;
}

function parseNarrativeBatch(
  content: string,
  batch: NarrativeBatch,
  sectionInput: SynthesisSectionInput,
  allowedBySection: ReturnType<typeof allowedEvidenceIdsBySection>,
): Partial<PersonalReportNarrativeSynthesis> {
  const batchInputValue = batchInput(sectionInput, batch);
  const raw = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as Record<string, unknown>;
  const normalized = normalizeEmptyOptionalSections(raw);
  const parsed = synthesisResponseSchema.parse(normalized);
  assertNarrativeNumbersAreGrounded(parsed, batchInputValue);
  assertNarrativeVoice(parsed);
  assertReportMechanicsProse(parsed);
  if (parsed.narrativeDetails) {
    assertNarrativeDetailsRouting(parsed.narrativeDetails, batch);
    assertNarrativeDetailsLengths(parsed.narrativeDetails);
    assertHypothesisLanguage(parsed, batchInputValue);
  }

  if (sectionInput.structuredContractReady) {
    for (const key of batch.structured) {
      if (structuredSectionAvailable(key, sectionInput) && !parsed.narrativeDetails?.[key]) {
        throw new Error('Narrative synthesis must cover every available report section.');
      }
    }
  }

  return materializeBatch(parsed, batch, batchInputValue, allowedBySection);
}

export async function synthesizePersonalReportNarrative(args: {
  report: PersonalReportV2;
  intendedDirection: string | null;
  apiKey: string;
  model: string;
  grounding: PersonalReportNarrativeGrounding;
  onFailure?: (
    code: PersonalReportNarrativeFailureCode,
    context?: PersonalReportNarrativeFailureContext,
  ) => void;
}): Promise<PersonalReportNarrativeSynthesis | null> {
  const { report, intendedDirection, apiKey, model } = args;
  const sectionInput = synthesisInputFromReport(report, intendedDirection, {
    evaluationInput: args.grounding.evaluationInput,
    ...(args.grounding.canvasDetails ? { canvasDetails: args.grounding.canvasDetails } : {}),
  });
  const allowed = allowedEvidenceIdsFor(report);
  const allowedBySection = allowedEvidenceIdsBySection(report, sectionInput);

  // Nothing available to write about yet — do not call the model for an
  // empty report; every section would come back null anyway.
  if (
    !sectionInput.coreIdentity &&
    !sectionInput.drivingForce &&
    !sectionInput.signaturePattern &&
    !sectionInput.emergingThemes &&
    !sectionInput.personalPositioning &&
    !sectionInput.proofOfMe &&
    !NARRATIVE_BATCHES.some((batch) => batch.structured.some((key) => structuredSectionAvailable(key, sectionInput)))
  ) {
    return null;
  }

  let failureContext: PersonalReportNarrativeFailureContext | undefined;
  try {
    const hasAvailableSection = (batch: NarrativeBatch) =>
      batch.structured.some((key) => structuredSectionAvailable(key, sectionInput));
    const batches = NARRATIVE_BATCHES.filter((batch) =>
      batch.required
        ? hasAvailableSection(batch)
        : false,
    );
    const outcomes = await Promise.all(
      batches.map(async (batch) => {
        try {
          const content = await openAiJsonCompletion({
            apiKey,
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: JSON.stringify({
                  input: batchInputForModel(sectionInput, batch),
                  requestedSections: [...batch.structured],
                  allowedEvidenceIds: batchAllowedEvidenceIds(batch, allowed, allowedBySection),
                }),
              },
            ],
            temperature: 0.4,
            maxTokens: batch.maxTokens,
          });
          return { batch, value: parseNarrativeBatch(content, batch, sectionInput, allowedBySection), error: null };
        } catch (error) {
          return { batch, value: null, error };
        }
      }),
    );
    const requiredFailure = outcomes.find((outcome) => outcome.batch.required && outcome.error);
    if (requiredFailure?.error) {
      failureContext = {
        batch: [...requiredFailure.batch.structured],
        ...(requiredFailure.error instanceof z.ZodError
          ? {
              issues: requiredFailure.error.issues.map(({ path, code, message }) => ({
                path: path.map(String),
                code,
                message,
              })),
            }
          : {}),
      } satisfies PersonalReportNarrativeFailureContext;
      throw requiredFailure.error;
    }

    const synthesis: PersonalReportNarrativeSynthesis = {};
    for (const outcome of outcomes) {
      if (!outcome.value) continue;
      const { narrativeDetails } = outcome.value;
      if (narrativeDetails) {
        synthesis.narrativeDetails = {
          ...(synthesis.narrativeDetails ?? {}),
          ...narrativeDetails,
        };
      }
    }
    return synthesis;
  } catch (error) {
    const code = failureCode(error);
    args.onFailure?.(code, failureContext);
    const detail = error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240);
    console.error('[personal-report-narrative-synthesis] rejected', {
      code,
      ...failureContext,
      detail: code === 'provider_error' ? detail : undefined,
      model,
    });
    return null;
  }
}

/**
 * Overlays a validated synthesis onto the deterministic report — prose only,
 * never a score, confidence, or availability verdict. `synthesis === null`
 * (not configured, call failed, or validation rejected it) returns `report`
 * completely unchanged, which is what makes this safe to call unconditionally
 * from the generation orchestration.
 */
export function applyNarrativeSynthesis(
  report: PersonalReportV2,
  synthesis: PersonalReportNarrativeSynthesis | null,
): PersonalReportV2 {
  if (!synthesis?.narrativeDetails || Object.keys(synthesis.narrativeDetails).length === 0) return report;
  return {
    ...report,
    ...(synthesis.narrativeDetails.snapshot
      ? { snapshot: { summary: synthesis.narrativeDetails.snapshot } }
      : {}),
    narrativeDetails: synthesis.narrativeDetails,
  };
}
