import { buildCompetencyProfile, type CompetencyClaim, type CompetencyProfile } from './f2-competency';
import { buildEvidenceProfile, type EvidenceItemInput, type EvidenceProfile } from './f3-evidence';
import {
  assessApplicantPositioning,
  assessMotivationConsistency,
  extractBehavioralPattern,
  scoreNarrativeBase,
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
import { buildReflectionProfile, type ReflectionProfile, type ReflectionRecord } from './f1-reflection';
import { buildProgrammeFitPlaceholder, type ProgrammeFitResult } from './f5-programme-fit';
import { runVaguenessGate, type VaguenessField, type VaguenessReport } from './f6-vagueness';
import { lowestConfidence, type Confidence } from './types';

/**
 * The GlowBal Shared Evaluation Engine — assembly.
 *
 * `runProfileEvaluation` is the single seam every AI surface goes through:
 * the Personal Report, the Matching Report, and later the Strategy Report all
 * read the same `ProfileEvaluation`, so they cannot disagree about the same
 * student's own profile (see docs/ai-evaluation-engine.md for the full
 * pipeline diagram and rationale).
 *
 * ─── PURE, AND THAT IS THE POINT (core principle 8) ──────────────────────────
 *
 * This function performs no I/O and makes no model call. Every input that
 * needed semantic judgement (CMCAITF field extraction for F1, competency
 * claim extraction for F2, activity-level fields for F4) arrives already
 * extracted, via `src/lib/ai/evaluation`. So the whole engine — every scoring
 * formula, every renormalization, every missing-input branch — is testable
 * against fixtures with no key, no network, and no bill.
 */

export type ProfileEvaluationInput = {
  subjectId: string;
  /** F6 — free-text fields to grade before anything narrative is built from them. */
  writtenFields: readonly VaguenessField[];
  /** F1 — one record per activity/achievement that has enough captured to attempt reflection scoring. */
  reflectionRecords: readonly ReflectionRecord[];
  /** F2 — competency claims already extracted and grounded. */
  competencyClaims: readonly CompetencyClaim[];
  /** F3 — every piece of evidence the student has entered or attached. */
  evidenceItems: readonly EvidenceItemInput[];
  /** F4 — one record per activity, for cross-activity synthesis. */
  narrativeActivities: readonly NarrativeActivity[];
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
  programmeFit: ProgrammeFitResult;
  /** The floor across every framework that produced a confidence value — never an average. See lowestConfidence. */
  confidence: Confidence;
  generatedAt: string;
};

export function runProfileEvaluation(input: ProfileEvaluationInput): ProfileEvaluation {
  // F6 — grade the student's own writing first; F1/F4's narrative material
  // rests on it.
  const vagueness = runVaguenessGate(input.writtenFields);

  // F1 — per-activity reflection quality, wherever CMCAITF fields exist.
  const reflection = buildReflectionProfile(input.reflectionRecords);

  // F2 — demonstrated, evidence-grounded competencies (not a pillar relabel).
  const competencies = buildCompetencyProfile(input.competencyClaims);

  // F3 — the evidence hierarchy: quality (A) and verification status (B).
  const evidence = buildEvidenceProfile(input.evidenceItems);

  // F4 — synthesis across activities, gated on the same evidence-count floor
  // throughout (0 → none, 1 → insufficient, 2 → emerging, 3+ → mature).
  const readiness = synthesisReadiness(input.narrativeActivities);
  const base = scoreNarrativeBase(input.narrativeActivities);
  const identity = synthesizeIdentity(input.narrativeActivities);
  const motivation = assessMotivationConsistency(input.narrativeActivities);
  const pattern = extractBehavioralPattern(input.narrativeActivities);
  const positioning = assessApplicantPositioning({
    identity,
    pattern,
    theme: null, // F4.4 themes are assessed per-theme by the caller (see f4-narrative-identity.ts); not folded into this single-object positioning call.
    intendedDirection: input.intendedDirection,
    coherent: identity.kind !== 'missing' && pattern.pattern !== null,
  });

  // F5 — interfaces only in this phase. See f5-programme-fit.ts.
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
    programmeFit,
    confidence: lowestConfidence(confidenceInputs),
    generatedAt: input.generatedAt,
  };
}
