import { buildCompetencyProfile, type CompetencyClaim, type CompetencyProfile } from './f2-competency';
import { buildEvidenceProfile, type EvidenceItemInput, type EvidenceProfile } from './f3-evidence';
import {
  assessApplicantPositioning,
  extractBehavioralPattern,
  synthesizeIdentity,
  synthesisReadiness,
  type ApplicantPositioning,
  type BehavioralPatternResult,
  type IdentitySynthesis,
  type MotivationConsistency,
  type NarrativeActivity,
  type NarrativeBaseMetrics,
  type SynthesisReadiness,
} from './f4-narrative-identity';
import { scoreNarrativeBaseFaithful } from './f4-quality';
import { buildReflectionProfile, type ReflectionProfile, type ReflectionRecord } from './f1-reflection';
import { buildProgrammeFitPlaceholder, type ProgrammeFitResult } from './f5-programme-fit';
import { runVaguenessGate, type VaguenessField, type VaguenessReport } from './f6-vagueness';
import {
  assessMotivationConsistencyWithProfile,
  type ProfileMotivation,
} from './profile-motivation';
import { lowestConfidence, type Confidence } from './types';

/** The seven Personal Reflection answer keys, q1–q7 (see personal-reflection.ts domain). */
export type ReflectionAnswerKey = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7';

export type ReflectionAnswerDimension =
  | 'interests_motivations'
  | 'values_growth'
  | 'problem_domains'
  | 'capability_ownership'
  | 'academic_direction'
  | 'career_direction'
  | 'environment_preference';

export const REFLECTION_ANSWER_DIMENSIONS: Record<ReflectionAnswerKey, ReflectionAnswerDimension> = {
  q1: 'interests_motivations',
  q2: 'values_growth',
  q3: 'problem_domains',
  q4: 'capability_ownership',
  q5: 'academic_direction',
  q6: 'career_direction',
  q7: 'environment_preference',
};

export type ReflectionAnswerSignal = {
  key: ReflectionAnswerKey;
  dimension: ReflectionAnswerDimension;
  /** Short AI-normalized finding. Raw `value` remains evidence-only. */
  summary?: string;
  value: string;
  /** repeated = ≥2 independent sources; isolated = this single answer only. */
  status: 'repeated' | 'isolated';
};

/**
 * The GlowBal Shared Evaluation Engine — assembly.
 *
 * `runProfileEvaluation` is the single seam every AI surface goes through:
 * the Personal Report, the Matching Report, and later the Strategy Report all
 * read the same `ProfileEvaluation`, so they cannot disagree about the same
 * student's own profile (see docs/ai-evaluation-engine.md for the full
 * pipeline diagram and rationale).
 *
 * This function performs no I/O and makes no model call. Semantic extraction
 * happens before this seam; formulas, evidence gates, confidence and missing
 * data handling remain deterministic and independently testable.
 */

export type ProfileEvaluationInput = {
  subjectId: string;
  /** F6 — free-text fields to grade before anything narrative is built from them. */
  writtenFields: readonly VaguenessField[];
  /** F1 — one record per activity/achievement that has enough captured to attempt reflection scoring. */
  reflectionRecords: readonly ReflectionRecord[];
  /** F2 — competency claims already extracted and source-grounded. */
  competencyClaims: readonly CompetencyClaim[];
  /** F3 — every piece of evidence the student has entered or attached. */
  evidenceItems: readonly EvidenceItemInput[];
  /** F4 — one record per activity, for cross-activity synthesis. */
  narrativeActivities: readonly NarrativeActivity[];
  /** Explicit motivation answers from the user-level Reflection profile. */
  profileMotivations?: readonly ProfileMotivation[];
  /**
   * The seven Personal Reflection answers, dimension-tagged (q1–q7 →
   * Identity/Direction dimensions; see lib/ai/reflection-analysis.ts).
   * Additive and optional so pre-existing callers stay valid.
   */
  reflectionAnswerSignals?: readonly ReflectionAnswerSignal[];
  /** Q4 capability/ownership evidence remains separate from motivation inputs. */
  capabilitySignals?: readonly ReflectionAnswerSignal[];
  /** Canonical direction bundle used by Growth/Matching consumers. */
  directionSignals?: {
    academicDirection?: string | null;
    careerDirection?: string | null;
    preferredEnvironment?: string | null;
  };
  /** F4.5 — stated only when the student has actually said where they are heading; never inferred. */
  intendedDirection: string | null;
  generatedAt: string;
};

export type F4Result = {
  base: NarrativeBaseMetrics;
  readiness: SynthesisReadiness;
  identity: IdentitySynthesis;
  motivation: MotivationConsistency;
  pattern: BehavioralPatternResult;
  positioning: ApplicantPositioning;
};

export type ProfileEvaluation = {
  subjectId: string;
  vagueness: VaguenessReport;
  reflection: ReflectionProfile;
  competencies: CompetencyProfile;
  evidence: EvidenceProfile;
  narrativeIdentity: F4Result;
  reflectionAnswerSignals?: ReflectionAnswerSignal[];
  capabilitySignals?: ReflectionAnswerSignal[];
  directionSignals?: ProfileEvaluationInput['directionSignals'];
  programmeFit: ProgrammeFitResult;
  /** The floor across every framework that produced a confidence value — never an average. */
  confidence: Confidence;
  generatedAt: string;
};

export function runProfileEvaluation(input: ProfileEvaluationInput): ProfileEvaluation {
  const vagueness = runVaguenessGate(input.writtenFields);
  const reflection = buildReflectionProfile(input.reflectionRecords);
  const competencies = buildCompetencyProfile(input.competencyClaims);
  const evidence = buildEvidenceProfile(input.evidenceItems);

  // F4 — synthesis across activities. The base scorer deliberately leaves
  // growth/evidence-density N/A until the input model can genuinely support
  // them instead of substituting unrelated proxies.
  const readiness = synthesisReadiness(input.narrativeActivities);
  const base = scoreNarrativeBaseFaithful(input.narrativeActivities);
  const reflectionSignals = input.reflectionAnswerSignals ?? [];
  const reflectionDirection = reflectionSignals
    .filter((signal) => signal.dimension === 'academic_direction' || signal.dimension === 'career_direction')
    .map((signal) => signal.value.trim())
    .filter(Boolean)
    .join('; ');
  const reflectionDirectionSignals = {
    academicDirection:
      reflectionSignals.find((signal) => signal.dimension === 'academic_direction')?.value ?? null,
    careerDirection:
      reflectionSignals.find((signal) => signal.dimension === 'career_direction')?.value ?? null,
    preferredEnvironment:
      reflectionSignals.find((signal) => signal.dimension === 'environment_preference')?.value ?? null,
  };
  const identity = {
    ...synthesizeIdentity(input.narrativeActivities, reflectionSignals),
    reflectionSignals: Object.fromEntries(
      reflectionSignals.map((signal) => [signal.dimension, signal.value]),
    ),
  };
  const motivation = assessMotivationConsistencyWithProfile(
    input.narrativeActivities,
    input.profileMotivations ?? [],
  );
  const pattern = extractBehavioralPattern(input.narrativeActivities);
  const capabilityEvidenceRefs = competencies.claims
    .flatMap((claim) => claim.evidenceRefs)
    .filter((ref) => ref.kind !== 'profile_reflection');
  const motivationEvidenceRefs = motivation.evidenceRefs;
  const positioning = assessApplicantPositioning({
    identity,
    pattern,
    theme: null,
    intendedDirection: input.intendedDirection ?? (reflectionDirection || null),
    coherent: identity.kind !== 'missing' && pattern.pattern !== null,
    capabilityEvidenceRefs,
    motivationEvidenceRefs,
  });

  // F5 — interfaces only in this phase. The Matching Report phase owns the
  // programme evidence profile and the actual F5 implementation.
  const programmeFit = buildProgrammeFitPlaceholder();

  const confidenceInputs: Confidence[] = [
    vagueness.confidence,
    reflection.confidence,
    competencies.confidence,
    evidence.confidence,
    base.confidence,
  ];

  return {
    subjectId: input.subjectId,
    vagueness,
    reflection,
    competencies,
    evidence,
    narrativeIdentity: { base, readiness, identity, motivation, pattern, positioning },
    reflectionAnswerSignals: [...reflectionSignals],
    ...(input.capabilitySignals ? { capabilitySignals: [...input.capabilitySignals] } : {}),
    directionSignals: {
      ...reflectionDirectionSignals,
      ...input.directionSignals,
    },
    programmeFit,
    confidence: lowestConfidence(confidenceInputs),
    generatedAt: input.generatedAt,
  };
}
