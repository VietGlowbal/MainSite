import type { AssessmentProvenance } from './assessment';
import type { ContentBlock } from '@/lib/match-insights';

/** Provenance for planning language created by the optional Core 3 AI layer. */
export type AiPlanningProvenance = {
  kind: 'ai_planning';
  provider: 'openai';
  model: string;
  promptVersion: string;
  enrichmentVersion: string;
  generatedAt: string;
  sourceDecisionIds: string[];
};

/** Factual provenance remains separate when a node also has AI planning copy. */
export type PlanNodeProvenance = AssessmentProvenance | AiPlanningProvenance;

/** What deterministic planning can honestly provide before enrichment or input. */
export type PlanReadiness = 'empty' | 'requires_user_input' | 'requires_enrichment';

export type PlanNodeReadiness = Exclude<PlanReadiness, 'empty'>;

/** A deterministic planning scaffold only; it contains no execution state. */
export type PlanResult = {
  id: string;
  readiness: PlanReadiness;
  phases: PlanPhase[];
};

export type PlanPhase = {
  id: string;
  title: string;
  objective: string;
  order: number;
  sourceDecisionIds: string[];
  sourceProvenances: PlanNodeProvenance[];
  steps: PlanStep[];
};

export type PlanStep = {
  id: string;
  title: string;
  objective: string;
  order: number;
  sourceDecisionIds: string[];
  sourceProvenances: PlanNodeProvenance[];
  microSteps: PlanMicroStep[];
};

/**
 * The smallest future-executable planning unit. The deterministic compiler
 * deliberately marks unresolved detail instead of inventing personal advice.
 */
export type PlanMicroStep = {
  id: string;
  title: string;
  /** Student-facing direction generated with the task, never execution state. */
  guidance?: string;
  order: number;
  readiness: PlanNodeReadiness;
  /**
   * Optional future execution form authored by planning. Its definition may be
   * regenerated; a student's submitted value is deliberately not part of Core 3.
   */
  contentSchema?: ContentBlock | null;
  sourceDecisionIds: string[];
  sourceProvenances: PlanNodeProvenance[];
};

/**
 * Legacy plans predate persisted guidance. Keep their task surface useful
 * immediately while a later reconciliation writes richer generated copy.
 */
export function plannerMicroStepGuidance(title: string, guidance?: string | null): string {
  const supplied = guidance?.trim();
  return supplied && supplied.length > 0
    ? supplied
    : `Complete this task: ${title} Review the related step, then mark it complete when you have finished.`;
}
