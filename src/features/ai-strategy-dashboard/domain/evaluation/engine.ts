import type { PillarBreakdown, PillarKey } from '@/lib/match-insights';
import { buildCompetencyProfile, type CompetencyProfile } from './competency';
import { buildEvidenceProfile, type EvidenceInput, type EvidenceProfile } from './evidence';
import { type Confidence } from './framework';
import {
  buildProgrammeFit,
  type ProgrammeFacts,
  type ProgrammeFit,
  type UniversityFacts,
} from './programme-fit';
import { availablePortraitSections, type NarrativeProfile, type PortraitSectionMeta } from './reflection';
import { runVaguenessGate, type VaguenessField, type VaguenessReport } from './vagueness';

/**
 * The Shared Evaluation Engine — assembly.
 *
 * `runEvaluation` is the single seam every AI surface goes through:
 *
 *     AI 1 Report     renders `portraitSections` and `programmeFit`
 *     AI 2 Feedback   reads `vagueness` + `competencies` + `evidence`
 *     AI 3 Strategy   will read `competencies.biggestOpportunity` + `profileGaps`
 *     AI 4 Breakdown  will turn that roadmap into phases
 *
 * ─── PURE, AND THAT IS THE POINT ─────────────────────────────────────────────
 *
 * This function performs no I/O and makes no model call. The one AI-dependent
 * input — the F1/F4 narrative — arrives as an argument, already generated and
 * normalised by `src/lib/ai/strategy-dashboard/`. So the whole engine can be
 * tested against fixtures, and a change to the pipeline can be verified without
 * a key, a network, or a bill.
 *
 * It also means a caller who has a stored narrative from last week can re-run
 * the engine against fresh scores without paying for a second call.
 *
 * ─── CONFIDENCE IS THE WEAKEST LINK, NOT THE AVERAGE ─────────────────────────
 *
 * Three frameworks report their own confidence and the engine reports the
 * lowest, rather than a mean. A portrait built on well-evidenced achievements
 * but vague written answers is not "medium confidence overall" — it is a report
 * whose narrative sections rest on nothing, and averaging that away would hide
 * exactly the thing the student needs to fix. Taking the floor is the version
 * that cannot flatter.
 */

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function lowestConfidence(values: readonly Confidence[]): Confidence {
  if (values.length === 0) return 'low';
  return values.reduce((worst, value) =>
    CONFIDENCE_RANK[value] < CONFIDENCE_RANK[worst] ? value : worst,
  );
}

export type EvaluationInput = {
  applicationId: string;
  /** Free-text fields the student wrote, for F6. */
  writtenFields: readonly VaguenessField[];
  /** Achievements and activities, for F3. */
  evidence: readonly EvidenceInput[];
  /** F1/F4 output, already generated. `EMPTY_NARRATIVE` when none exists yet. */
  narrative: NarrativeProfile;
  /** match-insights pillar scores, for F2 and F5. */
  pillars: Record<PillarKey, PillarBreakdown>;
  /** 0-100 weighted current score. */
  overallFitPercent: number;
  /** 0-100 ceiling. */
  goalFitPercent: number;
  /** How much real input backed match-insights. */
  matchConfidence: Confidence;
  university: UniversityFacts | null;
  programme: ProgrammeFacts;
  generatedAt: string;
};

export type EvaluationResult = {
  applicationId: string;
  /** F6 */
  vagueness: VaguenessReport;
  /** F3 */
  evidence: EvidenceProfile;
  /** F2 */
  competencies: CompetencyProfile;
  /** F1 + F4 */
  narrative: NarrativeProfile;
  /** F5 */
  programmeFit: ProgrammeFit;
  /** Portrait tabs that have content — see reflection.ts on hiding vs emptying. */
  portraitSections: PortraitSectionMeta[];
  /** How many sections are waiting on more input, so none vanish silently. */
  pendingSectionCount: number;
  confidence: Confidence;
  generatedAt: string;
};

export function runEvaluation(input: EvaluationInput): EvaluationResult {
  // F6 — grade the student's own writing first; everything narrative rests on it.
  const vagueness = runVaguenessGate(input.writtenFields);

  // F3 — rank what can actually be evidenced.
  const evidence = buildEvidenceProfile(input.evidence);

  // F2 — the pillar scores as admissions competencies.
  const competencies = buildCompetencyProfile(input.pillars, input.matchConfidence);

  // F5 — the course, the university and the student's standing against both.
  const programmeFit = buildProgrammeFit({
    competencies,
    university: input.university,
    programme: input.programme,
    overallFitPercent: input.overallFitPercent,
    goalFitPercent: input.goalFitPercent,
    confidence: input.matchConfidence,
  });

  // F1 + F4 — already generated; the engine only decides what is renderable.
  const portraitSections = availablePortraitSections(input.narrative, evidence);

  return {
    applicationId: input.applicationId,
    vagueness,
    evidence,
    competencies,
    narrative: input.narrative,
    programmeFit,
    portraitSections,
    pendingSectionCount: 6 - portraitSections.length,
    confidence: lowestConfidence([
      vagueness.confidence,
      evidence.confidence,
      competencies.confidence,
    ]),
    generatedAt: input.generatedAt,
  };
}
