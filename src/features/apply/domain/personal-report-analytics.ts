import {
  confidenceFromCoverage,
  type ApplicantPositioning,
  type EvidenceRef,
  type ProfileEvaluation,
} from '@/shared/evaluation';
import type {
  EmergingTheme,
  PositioningDimensionKey,
  ReportConfidence,
  SignaturePatternStepKey,
} from './personal-report';

/**
 * Deterministic report analytics — every chart on the Personal Report reads
 * from this, never from a number an LLM returned directly (implementation
 * spec §3, §19, §33: no fabricated axes, no per-chart model call).
 *
 * Every function here is a pure aggregation over the SAME `ProfileEvaluation`
 * (F1-F4) and `NarrativeActivity[]` the six report sections already read —
 * this module adds no new inputs and calls no model. Where the underlying
 * framework genuinely has nothing to report (e.g. F4's `growthArc`, which
 * `scoreNarrativeBaseFaithful` always leaves `null` because `NarrativeActivity`
 * carries no reliable chronology), the chart metric stays `null` rather than
 * a proxy value — the UI renders that as "N/A", never as an invented number.
 */

export type ReportChartMetric = {
  key: string;
  label: string;
  /** Canonical 0-100, or null when the underlying framework has nothing to report. */
  score: number | null;
  confidence: ReportConfidence;
  evidenceRefs: EvidenceRef[];
  explanation?: string | undefined;
};

export type SignaturePatternSupportItem = {
  key: SignaturePatternStepKey;
  label: string;
  /** How many activities actually support this step — the displayable number. */
  evidenceCount: number;
  /** evidenceCount normalised against the total supporting-experience count, for a consistent 0-100 bar fill. Null when there is nothing to normalise against. */
  strength: number | null;
  confidence: ReportConfidence;
};

export type ThemeChartItem = {
  theme: string;
  status: EmergingTheme['status'];
  /** 0-100 — a visual encoding of `status` (Possible=25 … Established=100), not an independently measured score. See `THEME_MATURITY_CHART_VALUE`. */
  maturityScore: number;
  evidenceCount: number;
  confidence: ReportConfidence;
};

export type PositioningDimension = {
  key: PositioningDimensionKey;
  /** Categorical encoding (strong=100, limited=25), or null when the overall positioning is insufficient_data — never invented decimal precision the framework does not have. */
  score: number | null;
  status: 'strong' | 'developing' | 'limited' | 'not_available';
  confidence: ReportConfidence;
  evidenceRefs: EvidenceRef[];
  explanation: string;
};

export type PersonalReportAnalytics = {
  /** F2 hard/soft/meta + F3 tangible/intangible/traceability — the six-axis "Competency & Evidence Profile" radar. */
  competencyEvidenceProfile: ReportChartMetric[];
  /** F4's five base metrics — the "Narrative identity signals" bar chart. */
  narrativeIdentitySignals: ReportChartMetric[];
  signaturePatternSupport: SignaturePatternSupportItem[];
  themeMaturity: ThemeChartItem[];
  positioningDimensions: PositioningDimension[];
  evidenceSummary: {
    totalItems: number;
    verification: { verified: number; attributable: number; stated: number };
    strength: { strong: number; moderate: number; limited: number };
    competencyClaims: { hard: number; soft: number; meta: number };
  };
};

/** A visual encoding of theme maturity category, not an independent score — implementation spec §12. */
const THEME_MATURITY_CHART_VALUE: Record<EmergingTheme['status'], number> = {
  possible_theme: 25,
  early_signal: 50,
  strong_emerging_theme: 75,
  established_theme: 100,
};

const SIGNATURE_PATTERN_STEP_LABEL: Record<SignaturePatternStepKey, string> = {
  trigger: 'Trigger',
  response: 'Response',
  method: 'Method',
  valueCreated: 'Value created',
};

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function competencyEvidenceProfile(evaluation: ProfileEvaluation): ReportChartMetric[] {
  const { categories } = evaluation.competencies;
  const evidence = evaluation.evidence.assessed;

  const skillAxis = (
    key: 'hard' | 'soft' | 'meta',
    label: string,
  ): ReportChartMetric => {
    const category = categories[key];
    return {
      key,
      label,
      score: category.score,
      confidence: category.confidence,
      evidenceRefs: category.claims.flatMap((claim) => claim.evidenceRefs),
      explanation:
        category.score === null
          ? `No ${label.toLowerCase()} claims recorded yet.`
          : `${category.claims.length} grounded claim${category.claims.length === 1 ? '' : 's'}.`,
    };
  };

  const impactAxis = (
    key: 'tangibleImpact' | 'intangibleImpact' | 'traceability',
    label: string,
  ): ReportChartMetric => {
    const scored = evidence
      .map((item) => item.metrics[key])
      .filter((value): value is number => value !== null);
    const score = average(scored);
    const refs = evidence
      .filter((item) => item.metrics[key] !== null)
      .flatMap((item) => item.evidenceRefs);
    return {
      key,
      label,
      score,
      confidence: confidenceFromCoverage(scored.length, evaluation.evidence.items.length),
      evidenceRefs: refs,
      explanation:
        score === null
          ? `No evidence yet describes ${label.toLowerCase()}.`
          : `Averaged across ${scored.length} evidence item${scored.length === 1 ? '' : 's'}.`,
    };
  };

  return [
    skillAxis('hard', 'Hard-skill specificity'),
    skillAxis('soft', 'Soft-skill specificity'),
    skillAxis('meta', 'Meta-skill / self-awareness'),
    impactAxis('tangibleImpact', 'Tangible impact'),
    impactAxis('intangibleImpact', 'Intangible impact'),
    impactAxis('traceability', 'Evidence traceability'),
  ];
}

function narrativeIdentitySignals(evaluation: ProfileEvaluation): ReportChartMetric[] {
  const { base } = evaluation.narrativeIdentity;
  const labels: Record<keyof typeof base.metrics, string> = {
    patternConsistency: 'Pattern consistency',
    thematicConvergence: 'Thematic convergence',
    growthArc: 'Growth arc',
    differentiation: 'Differentiation',
    evidenceDensity: 'Evidence density',
  };

  return (Object.keys(labels) as (keyof typeof base.metrics)[]).map((key) => ({
    key,
    label: labels[key],
    score: base.metrics[key],
    confidence: base.confidence,
    evidenceRefs: base.evidenceRefs,
    explanation:
      base.metrics[key] === null
        ? key === 'growthArc'
          ? 'Not scored until reliable activity chronology is captured.'
          : key === 'evidenceDensity'
            ? 'Assessed separately in the evidence framework below.'
            : 'Not enough activities yet to assess.'
        : undefined,
  }));
}

function signaturePatternSupport(
  steps: readonly { key: SignaturePatternStepKey; examples: string[] }[],
  supportingExperienceCount: number,
  confidence: ReportConfidence,
): SignaturePatternSupportItem[] {
  const byKey = new Map(steps.map((step) => [step.key, step]));
  const keys: SignaturePatternStepKey[] = ['trigger', 'response', 'method', 'valueCreated'];

  return keys.map((key) => {
    const step = byKey.get(key);
    const evidenceCount = step?.examples.length ?? 0;
    return {
      key,
      label: SIGNATURE_PATTERN_STEP_LABEL[key],
      evidenceCount,
      strength:
        supportingExperienceCount > 0
          ? Math.min(100, Math.round((evidenceCount / supportingExperienceCount) * 100))
          : null,
      confidence: step ? confidence : 'low',
    };
  });
}

function themeMaturity(themes: readonly EmergingTheme[]): ThemeChartItem[] {
  return themes.map((theme) => ({
    theme: theme.theme,
    status: theme.status,
    maturityScore: THEME_MATURITY_CHART_VALUE[theme.status],
    evidenceCount: theme.supportingExperiences.length,
    confidence: theme.confidence,
  }));
}

const POSITIONING_EXPLANATION: Record<
  PositioningDimensionKey,
  { strong: string; limited: string }
> = {
  authenticity: {
    strong: 'A consistent role or behaviour is grounded in real activity records, not a claimed trait.',
    limited: 'No consistent role or behaviour has been established yet.',
  },
  differentiation: {
    strong: 'A distinctive method combined with a clear theme sets this profile apart.',
    limited: 'A distinctive method and theme are not both established yet.',
  },
  coherence: {
    strong: 'Identity, signature pattern and theme all point toward the same direction.',
    limited: 'Identity, signature pattern and theme do not yet point toward the same direction.',
  },
  directionAlignment: {
    strong: 'The stated intended direction matches the strongest emerging theme.',
    limited: 'No stated intended direction to check alignment against, or it does not yet match a theme.',
  },
  credibility: {
    strong: 'Every element of this positioning is backed by linked evidence.',
    limited: 'Not every element of this positioning is backed by linked evidence yet.',
  },
};

function positioningDimensions(positioning: ApplicantPositioning): PositioningDimension[] {
  const insufficient = positioning.positioningStatus === 'insufficient_data';
  const flags: Record<PositioningDimensionKey, boolean> = {
    authenticity: positioning.authentic,
    differentiation: positioning.differentiated,
    coherence: positioning.coherent,
    directionAlignment: positioning.directionAligned,
    credibility: positioning.credible,
  };

  return (Object.keys(flags) as PositioningDimensionKey[]).map((key) => {
    if (insufficient) {
      return {
        key,
        score: null,
        status: 'not_available',
        confidence: positioning.confidence,
        evidenceRefs: [],
        explanation: 'Not enough data yet to assess this dimension.',
      };
    }
    const strong = flags[key];
    return {
      key,
      score: strong ? 100 : 25,
      status: strong ? 'strong' : 'limited',
      confidence: positioning.confidence,
      evidenceRefs: positioning.evidenceRefs,
      explanation: strong ? POSITIONING_EXPLANATION[key].strong : POSITIONING_EXPLANATION[key].limited,
    };
  });
}

function evidenceSummary(
  evaluation: ProfileEvaluation,
  proofStrengthCounts: { strong: number; moderate: number; limited: number },
): PersonalReportAnalytics['evidenceSummary'] {
  const { counts } = evaluation.evidence;
  const { categories } = evaluation.competencies;
  return {
    totalItems: evaluation.evidence.items.length,
    verification: { verified: counts.verified, attributable: counts.attributable, stated: counts.stated },
    strength: proofStrengthCounts,
    competencyClaims: {
      hard: categories.hard.claims.length,
      soft: categories.soft.claims.length,
      meta: categories.meta.claims.length,
    },
  };
}

/**
 * Builds every chart's data in one pass. Called once at report-generation
 * time and stored as part of the `PersonalReportV2` snapshot (implementation
 * spec §24) — never recomputed per-render, and never behind a second model
 * call.
 */
export function buildPersonalReportAnalytics(args: {
  evaluation: ProfileEvaluation;
  signaturePatternSteps: readonly { key: SignaturePatternStepKey; examples: string[] }[];
  supportingExperienceCount: number;
  signaturePatternConfidence: ReportConfidence;
  emergingThemes: readonly EmergingTheme[];
  proofStrengthCounts: { strong: number; moderate: number; limited: number };
}): PersonalReportAnalytics {
  const {
    evaluation,
    signaturePatternSteps,
    supportingExperienceCount,
    signaturePatternConfidence,
    emergingThemes,
    proofStrengthCounts,
  } = args;

  return {
    competencyEvidenceProfile: competencyEvidenceProfile(evaluation),
    narrativeIdentitySignals: narrativeIdentitySignals(evaluation),
    signaturePatternSupport: signaturePatternSupport(
      signaturePatternSteps,
      supportingExperienceCount,
      signaturePatternConfidence,
    ),
    themeMaturity: themeMaturity(emergingThemes),
    positioningDimensions: positioningDimensions(evaluation.narrativeIdentity.positioning),
    evidenceSummary: evidenceSummary(evaluation, proofStrengthCounts),
  };
}
