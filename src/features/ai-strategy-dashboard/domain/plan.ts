import type { AssessmentProvenance } from './assessment';
import type { ContentBlock } from '@/lib/match-insights';

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
  sourceProvenances: AssessmentProvenance[];
  steps: PlanStep[];
};

export type PlanStep = {
  id: string;
  title: string;
  objective: string;
  order: number;
  sourceDecisionIds: string[];
  sourceProvenances: AssessmentProvenance[];
  microSteps: PlanMicroStep[];
};

/**
 * The smallest future-executable planning unit. The deterministic compiler
 * deliberately marks unresolved detail instead of inventing personal advice.
 */
export type PlanMicroStep = {
  id: string;
  title: string;
  order: number;
  readiness: PlanNodeReadiness;
  /**
   * Optional future execution form authored by planning. Its definition may be
   * regenerated; a student's submitted value is deliberately not part of Core 3.
   */
  contentSchema?: ContentBlock | null;
  sourceDecisionIds: string[];
  sourceProvenances: AssessmentProvenance[];
};
