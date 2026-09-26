import { z } from 'zod';
import {
  assessApplicantPositioning,
  assessThemeMaturity,
  buildEvidenceToIdentityMap,
  confidenceFromCoverage,
  THEME_MATURITY_LABEL,
  type ApplicantPositioning,
  type Confidence,
  type EvidenceRef,
  type EvidenceStrength,
  type EvidenceTier,
  type IdentityProof,
  type NarrativeActivity,
  type ProfileEvaluation,
  type ReflectionAnswerKey,
  type ReflectionAnswerSignal,
  type ReflectionFinding,
  type ThemeMaturityResult,
} from '@/shared/evaluation';
import { buildPersonalReportAnalytics, type PersonalReportAnalytics } from './personal-report-analytics';
import {
  APPLICANT_IMPACT_METRIC_KEYS,
  type PersonalCanvasDetails,
} from './personal-canvas-details';
import type { EvidenceBank } from '@/shared/evidence/domain';

/**
 * The canonical Personal Report — user-level, six sections, built entirely
 * on top of the Shared Evaluation Engine's `ProfileEvaluation`
 * (src/shared/evaluation). See docs/ai-evaluation-engine.md for the engine
 * itself; this module is the ONE place that turns its F1-F4 output into the
 * exact six sections the product spec calls for: Core Identity, Driving
 * Force, Signature Pattern, Emerging Themes, Personal Positioning, Proof of
 * Me.
 *
 * Every headline, interpretation and explanation below is composed from
 * templates parameterised by the engine's structured findings. Where the
 * engine found nothing, the section says "more evidence needed" instead of
 * filling gaps with model-generated praise.
 *
 * This report never reads F5 Programme Fit and never computes an admissions
 * likelihood. `overallEvidenceConfidence` is evidence confidence only.
 */

export type ReportConfidence = Confidence;

/**
 * Why a given version of the Personal Report was generated — shown next to
 * each entry in the version-history dropdown. `'manual'` covers both the
 * first-ever "Create report" click and a student explicitly answering a
 * report question from the UI; `'matching_report'` and `'supplement_answer'`
 * are the two automatic triggers (see `regeneratePersonalReport`,
 * `src/features/apply/api/personal-report-generation.ts`). Open string in
 * storage, not a DB enum — this set can grow without a migration.
 */
export type PersonalReportTrigger = 'manual' | 'matching_report' | 'supplement_answer';

/** Maximum number of complete application report generations. */
export const APPLICATION_REPORT_GENERATION_LIMIT = 5;

/** One row of the version-history dropdown — no report content, just enough to label and pick a version. */
export type PersonalReportVersionSummary = {
  id: string;
  generatedAt: string;
  trigger: PersonalReportTrigger;
};

export type IntakeActionKind =
  | 'answer_reflection_question'
  | 'add_activity'
  | 'attach_evidence'
  | 'expand_activity_reflection';

export type IntakeAction = {
  kind: IntakeActionKind;
  label: string;
  href: string;
  /**
   * Set only on `answer_reflection_question` actions the report can accept
   * an answer for directly, without reopening (possibly locked) Candidate
   * Information — see `supabase-personal-report-supplements.sql`. The UI
   * renders an inline answer box instead of a plain link when this is
   * present; every other action kind (adding/expanding an activity,
   * attaching evidence) still needs the real form and has no `fieldKey`.
   */
  fieldKey?: string;
};

export type InsufficientData = {
  reason: string;
  actions: IntakeAction[];
};

/**
 * The one `student_profiles` field a report gap is currently answerable
 * for inline. Shared with `applyPersonalReportSupplements`
 * (`src/lib/ai/personal-report-v2.ts`) and the `POST
 * /api/ai-strategy/personal-report/supplement` route, which is the only
 * place allowed to accept a `fieldKey` from the client — never trust one
 * outside this set.
 */
export const STUDY_MOTIVATION_SUPPLEMENT_KEY = 'study_motivation';

const REFLECTION_HREF = '/ai-strategy/reflection';
const ACHIEVEMENTS_HREF = '/ai-strategy/reflection/achievements';

function addActivityAction(): IntakeAction {
  return { kind: 'add_activity', label: 'Add another activity or achievement', href: ACHIEVEMENTS_HREF };
}

function expandReflectionAction(): IntakeAction {
  return {
    kind: 'expand_activity_reflection',
    label: 'Add more detail to your existing activities (context, action, outcome)',
    href: ACHIEVEMENTS_HREF,
  };
}

function attachEvidenceAction(): IntakeAction {
  return {
    kind: 'attach_evidence',
    label: 'Attach supporting evidence (certificate, confirmation letter, document)',
    href: ACHIEVEMENTS_HREF,
  };
}

function answerReflectionAction(label: string, fieldKey: string): IntakeAction {
  return { kind: 'answer_reflection_question', label, href: REFLECTION_HREF, fieldKey };
}

export type CoreIdentitySection = {
  available: boolean;
  headline: string | null;
  interpretation: string | null;
  recurringRole: string | null;
  recurringBehaviours: string[];
  /** All observed activity behaviours; unlike recurringBehaviours, these are not an F4 recurrence claim. */
  observedBehaviours?: string[];
  valueOrientation: string | null;
  observations: string[];
  evidenceRefs: EvidenceRef[];
  confidence: ReportConfidence;
  stillDeveloping: string[];
  insufficientData: InsufficientData | null;
};

function buildCoreIdentity(evaluation: ProfileEvaluation, activities: readonly NarrativeActivity[]): CoreIdentitySection {
  const { identity, readiness } = evaluation.narrativeIdentity;
  const { recurringRole, recurringBehaviour, valueOrientation } = identity;
  const available = Boolean(recurringRole || recurringBehaviour || valueOrientation);

  const observedBehaviours = activities
    .map((activity) => activity.behaviour)
    .filter((behaviour): behaviour is string => Boolean(behaviour))
    .slice(0, 4);
  const recurringBehaviours = recurringBehaviour ? [recurringBehaviour] : [];

  const observations = activities
    .filter((activity) => activity.behaviour || activity.role)
    .slice(0, 5)
    .map((activity) => `${activity.title}: ${activity.behaviour ?? activity.role}`);

  if (!available) {
    const reason =
      readiness.level === 'none' || readiness.level === 'insufficient'
        ? 'The profile currently has fewer than two independent activities, so a recurring role or behaviour cannot be established yet.'
        : "The activities on file don't yet describe a clear role or specific action, so a consistent pattern can't be identified.";
    return {
      available: false,
      headline: null,
      interpretation: null,
      recurringRole: null,
      recurringBehaviours: [],
      observedBehaviours,
      valueOrientation: null,
      observations,
      evidenceRefs: identity.evidenceRefs,
      confidence: identity.confidence,
      stillDeveloping: identity.limitations,
      insufficientData: {
        reason,
        actions: readiness.activityCount < 2 ? [addActivityAction()] : [expandReflectionAction()],
      },
    };
  }

  const headline = recurringBehaviour
    ? `Someone who ${recurringBehaviour.charAt(0).toLowerCase()}${recurringBehaviour.slice(1)}`
    : recurringRole
      ? `Someone who typically takes on the role of ${recurringRole}`
      : 'An emerging pattern';

  const interpretationParts: string[] = [];
  if (recurringRole) interpretationParts.push(`Across multiple activities, the candidate repeatedly takes on the role of "${recurringRole}".`);
  if (recurringBehaviour) interpretationParts.push(`The clearest recurring behaviour is: ${recurringBehaviour.toLowerCase()}.`);
  if (valueOrientation) {
    interpretationParts.push(`The value this behaviour points toward is "${valueOrientation}".`);
  } else {
    interpretationParts.push('The value orientation behind this pattern still needs more activities to confirm.');
  }
  interpretationParts.push(
    readiness.level === 'mature'
      ? 'This observation is based on three or more independent activities.'
      : 'This is still an emerging pattern — more activities are needed before it becomes a confident finding.',
  );

  return {
    available: true,
    headline,
    interpretation: interpretationParts.join(' '),
    recurringRole,
    recurringBehaviours,
    observedBehaviours,
    valueOrientation,
    observations,
    evidenceRefs: identity.evidenceRefs,
    confidence: identity.confidence,
    stillDeveloping: identity.limitations,
    insufficientData: null,
  };
}

export type DrivingForceSection = {
  available: boolean;
  headline: string | null;
  explanation: string | null;
  primaryMotivation?: string | null;
  repeatedChoices?: string[];
  recurringProblems?: string[];
  decisionMaking?: string | null;
  underlyingValues?: string[];
  strategicInterpretation?: string | null;
  evidenceStrength?: 'strong' | 'moderate' | 'limited';
  motivationSource?: 'stated' | 'inferred' | 'insufficient';
  repeatedMotivations: string[];
  evidenceRefs: EvidenceRef[];
  confidence: ReportConfidence;
  isHypothesis: boolean;
  missingPersonalGrounding: string | null;
  reflectionPrompt: string | null;
  insufficientData: InsufficientData | null;
};

function buildDrivingForce(
  evaluation: ProfileEvaluation,
  activities: readonly NarrativeActivity[],
): DrivingForceSection {
  const motivation = evaluation.narrativeIdentity.motivation;
  const { motivationStatus, statedMotivation, recurrenceCount, personallyGrounded } = motivation;
  const isHypothesis = motivationStatus === 'hypothesis';
  const available = motivationStatus !== 'insufficient';

  const clarification = evaluation.vagueness.findings.find(
    (finding) => finding.field === 'studyMotivation' && finding.severity !== 'ok',
  );

  const corroboratedReflectionMotivations = (evaluation.reflectionAnswerSignals ?? [])
    .filter(
      (signal) =>
        signal.status === 'repeated' &&
        (signal.key === 'q1' || signal.key === 'q2' || signal.key === 'q3'),
    )
    .map((signal) => signal.summary)
    .filter((value): value is string => Boolean(value?.trim()));
  const repeatedMotivations = [
    ...corroboratedReflectionMotivations,
    ...(activities.some((activity) => Boolean(activity.statedMotivation))
      ? ['A motivation is consistently described in the activity-level reflection.']
      : []),
  ].slice(0, 4);
  const activityTitles = [...new Set(activities.map((activity) => activity.title.trim()).filter(Boolean))].slice(0, 4);
  const repeatedChoices = activities.length >= 2 ? activityTitles : [];
  const problemCounts = new Map<string, number>();
  for (const activity of activities) {
    const problem = activity.narrativeEvidence?.problem?.trim() || activity.domainTheme?.trim();
    if (problem) problemCounts.set(problem, (problemCounts.get(problem) ?? 0) + 1);
  }
  const recurringProblems = [...problemCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([, left], [, right]) => right - left)
    .map(([problem]) => problem)
    .slice(0, 4);
  const reflectedValues = (evaluation.reflectionAnswerSignals ?? [])
    .filter((signal) => signal.key === 'q2' && signal.status === 'repeated')
    .flatMap((signal) => signal.finding?.q2?.values ?? [])
    .filter((value): value is string => Boolean(value?.trim()));
  const underlyingValues = [...new Set([
    motivationStatus === 'established' ? evaluation.narrativeIdentity.identity.valueOrientation : null,
    ...reflectedValues,
  ].filter((value): value is string => Boolean(value?.trim())))].slice(0, 4);
  const pattern = evaluation.narrativeIdentity.pattern.pattern;
  const decisionMaking = pattern
    ? `When ${pattern.trigger.toLowerCase()}, the candidate tends to ${pattern.response.toLowerCase()} by ${pattern.method.toLowerCase()}.`
    : null;
  const evidenceStrength = motivation.confidence === 'high' ? 'strong' : motivation.confidence === 'medium' ? 'moderate' : 'limited';
  const motivationSource: DrivingForceSection['motivationSource'] = statedMotivation
    ? 'stated'
    : motivationStatus === 'hypothesis'
      ? 'inferred'
      : 'insufficient';
  if (!available) {
    return {
      available: false,
      headline: null,
      explanation: null,
      primaryMotivation: null,
      repeatedChoices: [],
      recurringProblems: [],
      decisionMaking: null,
      underlyingValues: [],
      strategicInterpretation: null,
      evidenceStrength: 'limited',
      motivationSource: 'insufficient',
      repeatedMotivations: [],
      evidenceRefs: motivation.evidenceRefs,
      confidence: motivation.confidence,
      isHypothesis: false,
      missingPersonalGrounding: null,
      reflectionPrompt: null,
      insufficientData: {
        reason: 'Not enough activities or clearly stated motivations exist yet to identify what genuinely drives the candidate.',
        actions: [
          addActivityAction(),
          answerReflectionAction(
            'Explain why you are interested in these subjects',
            STUDY_MOTIVATION_SUPPLEMENT_KEY,
          ),
        ],
      },
    };
  }

  const headline = isHypothesis
    ? 'An emerging hypothesis about motivation'
    : statedMotivation
      ? 'Motivation clearly confirmed'
      : 'Motivation is becoming clearer';

  const explanationParts: string[] = [];
  if (statedMotivation) {
    explanationParts.push('The candidate has clearly stated a motivation in the confirmed source material.');
  } else {
    explanationParts.push(
      'The candidate has not clearly stated their motivation; the finding below is inferred only from a repeated pattern of activity choices, and is therefore an EMERGING HYPOTHESIS, not a confirmed fact.',
    );
  }
  if (recurrenceCount >= 2) {
    explanationParts.push(`The candidate explained their reasoning across ${recurrenceCount} matching pieces of evidence.`);
  }
  const strategicInterpretation = underlyingValues.length > 0
    ? `The available evidence connects the motivation and choices to these values: ${underlyingValues.join(', ')}.`
    : explanationParts.join(' ');

  return {
    available: true,
    headline,
    explanation: explanationParts.join(' '),
    primaryMotivation: statedMotivation ?? (isHypothesis ? 'An emerging motivation hypothesis from repeated activity choices.' : repeatedMotivations[0] ?? null),
    repeatedChoices,
    recurringProblems,
    decisionMaking,
    underlyingValues,
    strategicInterpretation,
    evidenceStrength,
    motivationSource,
    repeatedMotivations,
    evidenceRefs: motivation.evidenceRefs,
    confidence: motivation.confidence,
    isHypothesis,
    missingPersonalGrounding: personallyGrounded
      ? null
      : 'The candidate has never explained why they chose these activities — this finding is based on repetition alone.',
    reflectionPrompt: clarification?.clarificationPrompt ?? null,
    insufficientData: null,
  };
}

export type SignaturePatternStepKey = 'trigger' | 'response' | 'method' | 'valueCreated';

export type SignaturePatternStep = {
  key: SignaturePatternStepKey;
  label: string;
  description: string;
  examples: string[];
};

export type SignaturePatternSection = {
  available: boolean;
  steps: SignaturePatternStep[];
  patternStrength: 'established' | 'emerging' | 'no_pattern' | 'insufficient';
  supportingExperienceCount: number;
  confidence: ReportConfidence;
  distinctiveness: string | null;
  evidenceRefs: EvidenceRef[];
  insufficientData: InsufficientData | null;
};

const STEP_LABEL: Record<SignaturePatternStepKey, string> = {
  trigger: 'What prompted the candidate to start',
  response: 'The role they took on',
  method: 'How they went about it',
  valueCreated: 'Value created',
};

function examplesFor(
  activities: readonly NarrativeActivity[],
  match: (activity: NarrativeActivity) => boolean,
): string[] {
  return activities.filter(match).map((activity) => activity.title).slice(0, 3);
}

function buildSignaturePattern(
  evaluation: ProfileEvaluation,
  activities: readonly NarrativeActivity[],
): SignaturePatternSection {
  const { pattern, base, readiness } = evaluation.narrativeIdentity;
  const supportingExperienceCount = readiness.activityCount;

  if (!pattern.pattern) {
    const patternStrength = readiness.level === 'none' || readiness.level === 'insufficient' ? 'insufficient' : 'no_pattern';
    return {
      available: false,
      steps: [],
      patternStrength,
      supportingExperienceCount,
      confidence: pattern.confidence,
      distinctiveness: null,
      evidenceRefs: pattern.evidenceRefs,
      insufficientData: {
        reason:
          readiness.activityCount < 2
            ? 'At least two independent activities are needed to identify a repeating behavioural sequence.'
            : "The activities on file don't yet show a consistent behavioural sequence (what prompted you to start, your role, your method, and the outcome).",
        actions: readiness.activityCount < 2 ? [addActivityAction()] : [expandReflectionAction()],
      },
    };
  }

  const { trigger, response, method, valueCreated } = pattern.pattern;
  const steps: SignaturePatternStep[] = [
    {
      key: 'trigger',
      label: STEP_LABEL.trigger,
      description: trigger,
      examples: examplesFor(activities, (a) => (a.domainTheme?.toLowerCase() ?? '') === trigger.toLowerCase()),
    },
    {
      key: 'response',
      label: STEP_LABEL.response,
      description: response,
      examples: examplesFor(activities, (a) => (a.role?.toLowerCase() ?? '') === response.toLowerCase()),
    },
    {
      key: 'method',
      label: STEP_LABEL.method,
      description: method,
      examples: examplesFor(activities, (a) => (a.behaviour ?? '').toLowerCase().startsWith(method.split(/\s+/)[0]?.toLowerCase() ?? '')),
    },
    {
      key: 'valueCreated',
      label: STEP_LABEL.valueCreated,
      description: valueCreated,
      examples: examplesFor(activities, (a) => Boolean(a.outcome)),
    },
  ];

  const differentiation = base.metrics.differentiation;
  const distinctiveness =
    differentiation !== null && differentiation >= 80
      ? 'The combination of several different themes with one consistent role is what makes this pattern distinctive, not just a repeated activity.'
      : 'This pattern is still limited to a narrow scope — activities in other themes are needed for it to become clearly distinctive.';

  return {
    available: true,
    steps,
    patternStrength: pattern.status === 'established' ? 'established' : 'emerging',
    supportingExperienceCount,
    confidence: pattern.confidence,
    distinctiveness,
    evidenceRefs: pattern.evidenceRefs,
    insufficientData: null,
  };
}

export type EmergingThemeStatus = 'established_theme' | 'strong_emerging_theme' | 'early_signal' | 'possible_theme';

export type EmergingTheme = {
  theme: string;
  status: EmergingThemeStatus;
  statusLabel: string;
  explanation: string;
  supportingExperiences: string[];
  confidence: ReportConfidence;
  limitation: string;
  evidenceRefs: EvidenceRef[];
};

export type EmergingThemesSection = {
  available: boolean;
  themes: EmergingTheme[];
  /** AI-authored synthesis over the deterministic theme facts; absent on historical versions. */
  narrative?: string | null;
  insufficientData: InsufficientData | null;
};

export function themeMaturityResults(activities: readonly NarrativeActivity[]): ThemeMaturityResult[] {
  const themeNames = new Set(
    activities.map((activity) => activity.domainTheme?.trim()).filter((value): value is string => Boolean(value)),
  );

  return [...themeNames].map((theme) =>
    assessThemeMaturity(
      theme,
      activities.map((activity) => ({
        linked: (activity.domainTheme?.trim().toLowerCase() ?? '') === theme.toLowerCase() ? 'explicit' : 'none',
      })),
    ),
  );
}

function buildEmergingThemes(
  activities: readonly NarrativeActivity[],
  themes: readonly ThemeMaturityResult[],
  reflectionSignals: readonly ReflectionAnswerSignal[] = [],
): EmergingThemesSection {
  const reflectedInterests = reflectionSignals.filter((signal) => signal.key === 'q1' && signal.summary?.trim());
  if (themes.length === 0 && reflectedInterests.length === 0) {
    return {
      available: false,
      themes: [],
      insufficientData: {
        reason: 'No activities are yet linked to a clear theme or area of interest.',
        actions: [addActivityAction(), expandReflectionAction()],
      },
    };
  }

  const built = themes
    .filter((theme) => theme.evidenceCount >= 1)
    .map((theme): EmergingTheme => {
      const supportingExperiences = activities
        .filter((activity) => (activity.domainTheme?.trim().toLowerCase() ?? '') === theme.theme.toLowerCase())
        .map((activity) => activity.title);
      const evidenceRefs = activities
        .filter((activity) => (activity.domainTheme?.trim().toLowerCase() ?? '') === theme.theme.toLowerCase())
        .flatMap((activity) => activity.evidenceRefs);

      const limitation =
        theme.status === 'established_theme'
          ? 'This theme is clearly established across multiple activities.'
          : `More activities clearly linked to "${theme.theme}" are needed for this theme to become more confident.`;

      return {
        theme: theme.theme,
        status: theme.status,
        statusLabel: THEME_MATURITY_LABEL[theme.status],
        explanation: `The candidate has shown interest in "${theme.theme}" across ${theme.evidenceCount} activities.`,
        supportingExperiences,
        confidence: confidenceFromCoverage(theme.explicitLinkCount, Math.max(theme.evidenceCount, 1)),
        limitation,
        evidenceRefs,
      };
    })
    .sort((a, b) => b.supportingExperiences.length - a.supportingExperiences.length)
    .slice(0, 5);

  // Q1 is an emerging-interest input, never an established theme by itself.
  // Keep it visible as self-reported context until activity evidence links it
  // to a recurring problem/domain.
  for (const signal of reflectedInterests) {
    const themeLabel = signal.summary!;
    if (built.some((theme) => theme.theme.toLowerCase() === themeLabel.toLowerCase())) continue;
    built.push({
      theme: themeLabel,
      status: 'possible_theme',
      statusLabel: THEME_MATURITY_LABEL.possible_theme,
      explanation: 'This interest is self-reported in Q1 and is not yet linked to an independent activity theme.',
      supportingExperiences: [],
      confidence: signal.status === 'repeated' ? 'medium' : 'low',
      limitation: 'Add an activity that demonstrates this interest before treating it as an established theme.',
      evidenceRefs: [{
        id: `profile:reflection_${signal.key}`,
        kind: 'profile_reflection',
        label: 'Personal reflection — interests and motivations',
      }],
    });
  }

  if (built.length === 0) {
    return {
      available: false,
      themes: [],
      insufficientData: {
        reason: 'No theme has appeared clearly enough yet to record as an emerging trend.',
        actions: [addActivityAction(), expandReflectionAction()],
      },
    };
  }

  return { available: true, themes: built, insufficientData: null };
}

/**
 * The five F4.5 positioning dimensions — also the axis keys for the
 * "Positioning Profile" radar chart (`personal-report-analytics.ts`, which
 * imports this rather than the other way around, to avoid a module cycle).
 */
export type PositioningDimensionKey =
  | 'authenticity'
  | 'differentiation'
  | 'coherence'
  | 'directionAlignment'
  | 'credibility';

export type PersonalPositioningSection = {
  available: boolean;
  statement: string | null;
  positioningStatus: ApplicantPositioning['positioningStatus'];
  authentic: boolean;
  differentiated: boolean;
  coherent: boolean;
  directionAligned: boolean;
  credible: boolean;
  /** Deterministic by default (one line per true dimension); overwritten by narrative synthesis when it succeeds. */
  whyThisFits: string[];
  whatPreventsStrongerPositioning: string[];
  confidence: ReportConfidence;
  evidenceRefs: EvidenceRef[];
  insufficientData: InsufficientData | null;
};

const POSITIONING_FIT_REASON: Record<PositioningDimensionKey, string> = {
  authenticity: 'A consistent role or behaviour is grounded in real activity records, not a claimed trait.',
  differentiation: 'A distinctive method combined with a clear theme sets this profile apart.',
  coherence: 'Identity, signature pattern and theme all point toward the same direction.',
  directionAlignment: 'The stated intended direction matches the strongest emerging theme.',
  credibility: 'Every element of this positioning is backed by linked evidence.',
};

function whyThisFits(positioning: ApplicantPositioning): string[] {
  const flags: Record<PositioningDimensionKey, boolean> = {
    authenticity: positioning.authentic,
    differentiation: positioning.differentiated,
    coherence: positioning.coherent,
    directionAlignment: positioning.directionAligned,
    credibility: positioning.credible,
  };
  return (Object.keys(flags) as PositioningDimensionKey[])
    .filter((key) => flags[key])
    .map((key) => POSITIONING_FIT_REASON[key]);
}

function buildPersonalPositioning(
  evaluation: ProfileEvaluation,
  themes: readonly ThemeMaturityResult[],
  intendedDirection: string | null,
  reflectionSignals: readonly ReflectionAnswerSignal[] = [],
): PersonalPositioningSection {
  const { identity, pattern } = evaluation.narrativeIdentity;
  const q3 = reflectionSignals.find((signal) => signal.key === 'q3' && signal.summary?.trim());
  const reflectedProblem = q3
    ? {
        theme: q3.summary!,
        status: q3.status === 'repeated' ? ('early_signal' as const) : ('possible_theme' as const),
        evidenceCount: q3.status === 'repeated' ? 2 : 1,
        explicitLinkCount: 0,
      }
    : null;
  const topTheme = [...themes, ...(reflectedProblem ? [reflectedProblem] : [])]
    .sort((a, b) => b.evidenceCount - a.evidenceCount)[0] ?? null;
  const coherent = identity.kind !== 'missing' && pattern.pattern !== null && (topTheme === null || topTheme.evidenceCount > 0);

  const positioning = assessApplicantPositioning({
    identity,
    pattern,
    theme: topTheme,
    intendedDirection,
    coherent,
    themeEvidenceRefs: q3
      ? [{ id: `profile:reflection_${q3.key}`, kind: 'profile_reflection', label: 'Personal reflection — problem domains' }]
      : [],
    capabilityEvidenceRefs: evaluation.competencies.claims
      .flatMap((claim) => claim.evidenceRefs)
      .filter((ref) => ref.kind !== 'profile_reflection'),
    motivationEvidenceRefs: evaluation.narrativeIdentity.motivation.evidenceRefs,
  });

  if (positioning.positioningStatus === 'insufficient_data') {
    return {
      available: false,
      statement: null,
      positioningStatus: positioning.positioningStatus,
      authentic: false,
      differentiated: false,
      coherent: false,
      directionAligned: false,
      credible: false,
      whyThisFits: [],
      whatPreventsStrongerPositioning: positioning.limitations,
      confidence: positioning.confidence,
      evidenceRefs: positioning.evidenceRefs,
      insufficientData: {
        reason: 'Not enough data about role, behavioural pattern, or area of interest exists yet to build a positioning statement.',
        actions: [addActivityAction(), expandReflectionAction()],
      },
    };
  }

  const statementParts: string[] = [];
  if (positioning.identity) statementParts.push(`is someone who ${positioning.identity.toLowerCase()}`);
  if (positioning.signatureStrength) statementParts.push(`creates value by ${positioning.signatureStrength.toLowerCase()}`);
  if (positioning.theme) statementParts.push(`is deeply interested in "${positioning.theme}"`);
  if (positioning.intendedDirection) statementParts.push(`is heading toward ${positioning.intendedDirection.toLowerCase()}`);

  const statement =
    statementParts.length > 0
      ? `The candidate ${statementParts.join(', ')}.`
      : 'Not enough data yet to state a complete positioning statement.';

  return {
    available: true,
    statement,
    positioningStatus: positioning.positioningStatus,
    authentic: positioning.authentic,
    differentiated: positioning.differentiated,
    coherent: positioning.coherent,
    directionAligned: positioning.directionAligned,
    credible: positioning.credible,
    whyThisFits: whyThisFits(positioning),
    whatPreventsStrongerPositioning: positioning.limitations,
    confidence: positioning.confidence,
    evidenceRefs: positioning.evidenceRefs,
    insufficientData: null,
  };
}

export type ProofCard = {
  activityId: string;
  title: string;
  organisation?: string | null;
  level?: string | null;
  year?: number | null;
  period?: string | null;
  competition?: string | null;
  evidenceKey?: string | null;
  reviewStatus?: string | null;
  sourceType?: string | null;
  sources?: unknown[];
  role: string | null;
  personalContribution: string | null;
  outcome: string | null;
  competenciesDemonstrated: string[];
  supports: string[];
  evidenceStrength: EvidenceStrength;
  verificationStatus: EvidenceTier;
  evidenceSource: string | null;
  evidenceRefs: EvidenceRef[];
};

export type ProofOfMeSection = {
  available: boolean;
  cards: ProofCard[];
  /** AI-authored synthesis over the deterministic proof cards; absent on historical versions. */
  narrative?: string | null;
  insufficientData: InsufficientData | null;
};

function verificationFor(
  proof: IdentityProof,
  evaluation: ProfileEvaluation,
): { tier: EvidenceTier; source: string | null } {
  const matched = evaluation.evidence.items.find((item) =>
    proof.evidenceRefs.some((ref) => ref.id === item.itemId),
  );
  return { tier: matched?.tier ?? 'stated', source: matched?.title ?? null };
}

function supportsFor(
  activity: NarrativeActivity | undefined,
  evaluation: ProfileEvaluation,
  themes: readonly ThemeMaturityResult[],
): string[] {
  const { identity, pattern } = evaluation.narrativeIdentity;
  const supports: string[] = [];

  if (activity?.role && identity.recurringRole && activity.role.toLowerCase() === identity.recurringRole.toLowerCase()) {
    supports.push('Core Identity');
  }
  if (
    activity?.behaviour &&
    identity.recurringBehaviour &&
    activity.behaviour.toLowerCase() === identity.recurringBehaviour.toLowerCase()
  ) {
    if (!supports.includes('Core Identity')) supports.push('Core Identity');
  }
  if (pattern.pattern && activity) {
    const { trigger, response, method } = pattern.pattern;
    const matchesPattern =
      (activity.domainTheme?.toLowerCase() ?? '') === trigger.toLowerCase() ||
      (activity.role?.toLowerCase() ?? '') === response.toLowerCase() ||
      (activity.behaviour ?? '').toLowerCase().startsWith(method.split(/\s+/)[0]?.toLowerCase() ?? '');
    if (matchesPattern) supports.push('Signature Pattern');
  }
  if (activity?.statedMotivation) supports.push('Driving Force');
  const theme = themes.find((entry) => entry.theme.toLowerCase() === (activity?.domainTheme?.toLowerCase() ?? ''));
  if (theme) supports.push(`Emerging Themes: ${theme.theme}`);

  return supports;
}

/** Shared by `buildProofOfMe` and the report analytics builder, so the evidence-strength counts shown in the KPI band always match what the Proof of Me cards actually display. */
function competenciesByActivityMap(evaluation: ProfileEvaluation): Map<string, string[]> {
  const competenciesByActivity = new Map<string, string[]>();
  for (const claim of evaluation.competencies.claims) {
    for (const ref of claim.evidenceRefs) {
      const existing = competenciesByActivity.get(ref.id) ?? [];
      if (!existing.includes(claim.label)) existing.push(claim.label);
      competenciesByActivity.set(ref.id, existing);
    }
  }
  return competenciesByActivity;
}

function proofOfMeStrengthCounts(
  evaluation: ProfileEvaluation,
  activities: readonly NarrativeActivity[],
): { strong: number; moderate: number; limited: number } {
  const proofs = buildEvidenceToIdentityMap(activities, competenciesByActivityMap(evaluation));
  return {
    strong: proofs.filter((proof) => proof.evidenceStrength === 'strong').length,
    moderate: proofs.filter((proof) => proof.evidenceStrength === 'moderate').length,
    limited: proofs.filter((proof) => proof.evidenceStrength === 'limited').length,
  };
}

function buildProofOfMe(
  evaluation: ProfileEvaluation,
  activities: readonly NarrativeActivity[],
  themes: readonly ThemeMaturityResult[],
): ProofOfMeSection {
  if (activities.length === 0) {
    return {
      available: false,
      cards: [],
      insufficientData: {
        reason: 'No activities or achievements have been recorded yet.',
        actions: [addActivityAction(), attachEvidenceAction()],
      },
    };
  }

  const proofs = buildEvidenceToIdentityMap(activities, competenciesByActivityMap(evaluation));
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));

  const cards: ProofCard[] = proofs.slice(0, 12).map((proof) => {
    const activity = activityById.get(proof.activityId);
    const { tier, source } = verificationFor(proof, evaluation);
    return {
      activityId: proof.activityId,
      title: proof.title,
      organisation: activity?.organisation ?? null,
      level: activity?.level ?? null,
      year: activity?.year ?? null,
      period: activity?.period ?? null,
      competition: activity?.competition ?? null,
      evidenceKey: activity?.evidenceKey ?? null,
      reviewStatus: activity?.reviewStatus ?? null,
      sourceType: activity?.sourceType ?? null,
      sources: activity?.sources ?? [],
      role: proof.role,
      personalContribution: proof.personalContribution,
      outcome: proof.outcome,
      competenciesDemonstrated: proof.competenciesDemonstrated,
      supports: supportsFor(activity, evaluation, themes),
      evidenceStrength: proof.evidenceStrength,
      verificationStatus: tier,
      evidenceSource: source,
      evidenceRefs: proof.evidenceRefs,
    };
  });

  return { available: true, cards, insufficientData: null };
}

export type ReportOverview = { summary: string; evidenceRefs: EvidenceRef[] };
export type ReportOverallSummary = { paragraphs: string[]; evidenceRefs: EvidenceRef[] };

export type PersonalReportInsight = {
  kind:
    | 'core_identity'
    | 'driving_force'
    | 'capability'
    | 'social_proof'
    | 'growth_area'
    | 'competitive_advantage'
    | 'takeaway';
  statement: string;
  scope: 'repeated' | 'isolated' | 'insufficient';
  strength: 'strong' | 'moderate' | 'weak';
  confidence: ReportConfidence;
  evidenceIds: string[];
  limitations: string[];
  currentGap?: string;
  importance?: string;
  direction?: string;
};

export type PersonalReportEvidenceCoverage = {
  strongEvidence: string[];
  weakEvidence: string[];
  insufficientEvidence: string[];
};

export type PersonalReportKeyTakeaways = {
  whatMakesYouStandOut: PersonalReportInsight;
  competitiveAdvantage: PersonalReportInsight;
  growthOpportunity: PersonalReportInsight;
};

export type PersonalReportNarrativeDetails = {
  snapshot?: string;
  coreIdentity?: {
    identityStatement: string;
    evidenceIds: string[];
    definingTraits: Array<{
      characteristic: string;
      insight: string;
      evidenceIds: string[];
      whyItMatters: string;
      supportingExperienceTitles?: string[];
      evidenceStrength?: 'strong' | 'moderate' | 'limited';
      maturity?: 'established' | 'emerging';
      scope: 'repeated' | 'emerging';
      confidence: ReportConfidence;
    }>;
  };
  drivingForce?: {
    primaryMotivation: string;
    repeatedChoices: string[];
    recurringProblems: string[];
    decisionMaking?: string;
    underlyingValues: string[];
    strategicInterpretation: string;
    evidenceStrength: 'strong' | 'moderate' | 'limited';
    isHypothesis: boolean;
    evidenceIds: string[];
  };
  provenCapabilities?: {
    overview: string;
    overviewEvidenceIds: string[];
    capabilities: Array<{
      capability: string;
      evidenceIds: string[];
      supportingActivities: string[];
      howDemonstrated: string;
      whyItMatters: string;
      applicationRelevance?: string;
    }>;
    combinationInsight: string;
    combinationEvidenceIds: string[];
  };
  socialProof?: {
    conclusion: string;
    metricKeys: string[];
    evidenceIds: string[];
  };
  profilePositioning?: {
    experienceConnection: {
      strongestProfileThread: string;
      connectionExplanation: string;
      confidence: ReportConfidence;
      supportingExperienceCount: number;
      /** The deterministic primary anchor used to explain the profile thread. */
      anchorExperience?: string | null;
      supportingExperienceTitles?: string[];
      evidenceIds: string[];
    };
    positioningOptions: Array<{
      title: string;
      statement: string;
      supportingEvidenceIds: string[];
      supportingExperienceTitles: string[];
    }>;
    profileNarrative: string;
    profileNarrativeEvidenceIds: string[];
  };
  keyTakeaways?: {
    whatMakesYouStandOut: {
      title: string;
      insight: string;
      evidencePattern: string;
      whyItMatters: string;
      evidenceIds: string[];
    };
    competitiveAdvantage: {
      title: string;
      advantageStatement: string;
      supportingEvidence: string;
      applicationRelevance: string;
      evidenceIds: string[];
    };
    growthOpportunity: {
      title: string;
      growthArea: string;
      currentGap: string;
      recommendedDirection: string;
      whyItMatters: string;
      basis?: 'evidence' | 'missing_information';
      evidenceIds: string[];
    };
  };
};

export const PERSONAL_REPORT_CONTRACT_VERSION = 'personal-report-v8-post-review-framework-complete';

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

// Activity/reflection text is evidence, not report prose. Older snapshots can
// contain the applicant's full first-person answer here, so never interpolate
// that raw text into the deterministic executive summary.
function snapshotPhrase(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  if (
    candidate.length > 180 ||
    /(?:^|[\s(])(?:i(?:['’](?:m|ve|d|ll))?|me|my|mine|we(?:['’](?:re|ve))?|our|ours|us|tôi|mình|em(?=\s+(?:là|đã|có|muốn|thích|được|vì))|chúng tôi|chúng mình|của tôi|của mình)(?=$|[\s,.;:!?])/iu.test(
      candidate,
    )
  ) {
    return fallback;
  }
  return candidate.replace(/[.!?]+$/, '');
}

function snapshotSummary(
  coreIdentity: CoreIdentitySection,
  drivingForce: DrivingForceSection,
  signaturePattern: SignaturePatternSection,
  proofOfMe: ProofOfMeSection,
  personalPositioning: PersonalPositioningSection,
  growthAreas: PersonalReportInsight[],
): string {
  const identity = coreIdentity.available
    ? snapshotPhrase(coreIdentity.headline ?? undefined, 'an emerging identity signal')
    : 'an identity that is still being established';
  const positioning = personalPositioning.available
    ? snapshotPhrase(personalPositioning.statement ?? undefined, 'a developing position connecting the current experiences')
    : 'a unique position that still needs clearer supporting evidence';
  const prominentBehaviour = snapshotPhrase(
    signaturePattern.steps.find((step) => step.key === 'method')?.description ?? coreIdentity.recurringBehaviours[0] ?? coreIdentity.observedBehaviours?.[0],
    signaturePattern.available ? 'no single behaviour is established as prominent yet' : 'no single behaviour is established as prominent yet',
  );
  const motivation = drivingForce.available
    ? snapshotPhrase(drivingForce.repeatedMotivations[0], 'an explicitly stated motivation')
    : 'motivation that is not yet confirmed across the available record';
  const gap = snapshotPhrase(
    growthAreas[0]?.currentGap || growthAreas[0]?.statement,
    'more specific evidence about ownership, outcomes, and future direction',
  );
  const sentences = [
    `Overall identity: ${identity}.`,
    `Unique positioning: ${positioning}.`,
    `The most prominent behavioural or activity signal is ${prominentBehaviour}; ${signaturePattern.available ? 'this is treated as an emerging or established pattern according to the number of independent records behind it' : 'it is not yet treated as a recurring pattern'}.`,
    `The clearest stated or inferred motivation is ${motivation}.`,
    `Potential and development direction: ${gap}.`,
    `The current evidence base contains ${proofOfMe.cards.length} recorded experience${proofOfMe.cards.length === 1 ? '' : 's'}, so repeated patterns remain distinct from isolated observations and self-reported aspirations.`,
    `Overall impression: the profile contains useful applicant-specific signals, while its strongest future positioning will depend on adding concrete outcomes, ownership details, and evidence that tests the emerging themes.`,
  ];
  let summary = sentences.join(' ');
  if (wordCount(summary) < 150) {
    summary += ' This snapshot separates directly stated information, observed actions, emerging interpretations, and claims that remain unconfirmed. It is a current evidence-aware view of the applicant rather than a prediction about external selection decisions.';
  }
  return wordCount(summary) > 200 ? summary.split(/\s+/).slice(0, 200).join(' ') : summary;
}

function insight(
  args: Omit<PersonalReportInsight, 'evidenceIds'> & { evidenceIds?: string[] },
): PersonalReportInsight {
  return { ...args, evidenceIds: Array.from(new Set(args.evidenceIds ?? [])) };
}

function evidenceCoverageFromBank(
  evidenceBank: EvidenceBank,
  fallback: PersonalReportEvidenceCoverage,
): PersonalReportEvidenceCoverage {
  const strongEvidence = evidenceBank.claims
    .filter((claim) => claim.status === 'verified')
    .flatMap((claim) => claim.sourceRefs);
  const weakEvidence = evidenceBank.claims
    .filter((claim) => claim.status !== 'verified')
    .flatMap((claim) => claim.sourceRefs);

  return {
    strongEvidence: Array.from(new Set(strongEvidence)),
    weakEvidence: Array.from(new Set(weakEvidence)),
    insufficientEvidence: Array.from(
      new Set([
        ...fallback.insufficientEvidence,
        ...evidenceBank.missingInformation.map((item) => `${item.area}: ${item.note}`),
      ]),
    ),
  };
}

function buildApplicationInsights(args: {
  evaluation: ProfileEvaluation;
  coreIdentity: CoreIdentitySection;
  drivingForce: DrivingForceSection;
  signaturePattern: SignaturePatternSection;
  personalPositioning: PersonalPositioningSection;
  proofOfMe: ProofOfMeSection;
  intendedDirection: string | null;
  reflectionAnswerSignals?: readonly ReflectionAnswerSignal[];
  evidenceBank?: EvidenceBank;
}): {
  growthAreas: PersonalReportInsight[];
  competitiveAdvantages: PersonalReportInsight[];
  keyTakeaways: PersonalReportKeyTakeaways;
  evidenceCoverage: PersonalReportEvidenceCoverage;
} {
  const {
    evaluation,
    coreIdentity,
    drivingForce,
    signaturePattern,
    personalPositioning,
    proofOfMe,
    intendedDirection,
    reflectionAnswerSignals = [],
  } = args;
  const growthAreas: PersonalReportInsight[] = [];
  const addGrowth = (gap: string, confidence: ReportConfidence, evidenceIds: string[]) =>
    growthAreas.push(
      insight({
        kind: 'growth_area',
        statement: gap,
        scope: 'insufficient',
        strength: 'weak',
        confidence,
        evidenceIds,
        limitations: [gap],
        currentGap: gap,
        importance: 'More specific support is needed before this part of the profile can be treated as established.',
        direction: 'Add a concrete example, outcome, reflection, or document that addresses this gap.',
      }),
    );

  for (const gap of coreIdentity.stillDeveloping) {
    addGrowth(gap, coreIdentity.confidence, coreIdentity.evidenceRefs.map((ref) => ref.id));
  }
  if (drivingForce.missingPersonalGrounding) {
    addGrowth(
      drivingForce.missingPersonalGrounding,
      drivingForce.confidence,
      drivingForce.evidenceRefs.map((ref) => ref.id),
    );
  }
  for (const card of proofOfMe.cards.filter((item) => item.evidenceStrength === 'limited')) {
    addGrowth(`The evidence behind "${card.title}" is limited.`, 'low', card.evidenceRefs.map((ref) => ref.id));
  }
  const activityCapabilityRefs = evaluation.competencies.claims
    .flatMap((claim) => claim.evidenceRefs)
    .filter((ref) => ref.kind !== 'profile_reflection');
  if (activityCapabilityRefs.length === 0) {
    addGrowth(
      'No capability is yet grounded in activity or achievement evidence; the Q4 self-report remains uncorroborated.',
      'low',
      evaluation.capabilitySignals?.flatMap((signal) => [`profile:reflection_${signal.key}`]) ?? [],
    );
  }
  for (const [key, label] of [
    ['q2', 'values/growth signal'],
    ['q5', 'academic direction'],
    ['q6', 'future/career direction'],
    ['q7', 'preferred environment'],
  ] as const) {
    const signal = reflectionAnswerSignals.find((item) => item.key === key);
    if (!signal) {
      addGrowth(`The ${label} is not stated in the confirmed snapshot yet.`, 'low', []);
    } else if (signal.status === 'isolated') {
      addGrowth(`The ${label} is self-reported and needs independent evidence or clearer linkage.`, 'low', [
        `profile:reflection_${key}`,
      ]);
    }
  }
  for (const gap of personalPositioning.whatPreventsStrongerPositioning) {
    addGrowth(gap, personalPositioning.confidence, personalPositioning.evidenceRefs.map((ref) => ref.id));
  }
  if (!intendedDirection) {
    addGrowth('No canonical intended major or future direction is recorded yet.', 'low', []);
  }
  if (growthAreas.length === 0) {
    addGrowth('The current snapshot does not identify a specific next growth area yet.', 'low', []);
  }

  const competitiveAdvantages: PersonalReportInsight[] = [];
  if (coreIdentity.available && coreIdentity.recurringRole) {
    competitiveAdvantages.push(
      insight({
        kind: 'competitive_advantage',
        statement: `A repeated role is visible: ${coreIdentity.recurringRole}.`,
        scope: coreIdentity.evidenceRefs.length > 1 ? 'repeated' : 'isolated',
        strength: coreIdentity.evidenceRefs.length > 1 ? 'strong' : 'moderate',
        confidence: coreIdentity.confidence,
        evidenceIds: coreIdentity.evidenceRefs.map((ref) => ref.id),
        limitations: coreIdentity.evidenceRefs.length > 1 ? [] : ['Only one supporting record is available.'],
      }),
    );
  }
  const groundedCapabilities = evaluation.competencies.claims
    .filter((claim) => claim.evidenceRefs.some((ref) => ref.kind !== 'profile_reflection'))
    .map((claim) => claim.label)
    .slice(0, 4);
  if (groundedCapabilities.length > 0) {
    const socialProofCount = proofOfMe.cards.filter(
      (card) => card.organisation || card.level || card.year || card.period || card.competition || card.outcome,
    ).length;
    competitiveAdvantages.push(
      insight({
        kind: 'competitive_advantage',
        statement: `Grounded capabilities (${groundedCapabilities.join(', ')}) are supported by ${socialProofCount} activity or achievement record${socialProofCount === 1 ? '' : 's'} and the current positioning intersection.`,
        scope: socialProofCount > 1 ? 'repeated' : 'isolated',
        strength: socialProofCount > 1 ? 'strong' : 'moderate',
        confidence: evaluation.competencies.confidence,
        evidenceIds: [
          ...evaluation.competencies.claims.flatMap((claim) => claim.evidenceRefs.map((ref) => ref.id)),
          ...personalPositioning.evidenceRefs.map((ref) => ref.id),
        ],
        limitations: socialProofCount > 1 ? [] : ['More independent social proof is needed.'],
      }),
    );
  }
  if (signaturePattern.available && signaturePattern.patternStrength === 'established') {
    const method = signaturePattern.steps.find((step) => step.key === 'method')?.description;
    if (method) {
      competitiveAdvantages.push(
        insight({
          kind: 'competitive_advantage',
          statement: `The established pattern includes this method: ${method}.`,
          scope: 'repeated',
          strength: 'strong',
          confidence: signaturePattern.confidence,
          evidenceIds: signaturePattern.evidenceRefs.map((ref) => ref.id),
          limitations: [],
        }),
      );
    }
  }

  const standout = insight({
    kind: 'takeaway',
    statement: coreIdentity.available
      ? [
          coreIdentity.headline || 'A recurring identity signal is visible.',
          signaturePattern.available ? signaturePattern.steps.find((step) => step.key === 'method')?.description : null,
          personalPositioning.available ? personalPositioning.statement : null,
        ]
          .filter(Boolean)
          .join(' ')
      : 'The current evidence does not yet establish what makes the candidate stand out.',
    scope: coreIdentity.available ? (coreIdentity.evidenceRefs.length > 1 ? 'repeated' : 'isolated') : 'insufficient',
    strength: coreIdentity.available ? 'moderate' : 'weak',
    confidence: coreIdentity.confidence,
    evidenceIds: Array.from(
      new Set([
        ...coreIdentity.evidenceRefs.map((ref) => ref.id),
        ...signaturePattern.evidenceRefs.map((ref) => ref.id),
        ...personalPositioning.evidenceRefs.map((ref) => ref.id),
      ]),
    ),
    limitations: coreIdentity.available ? personalPositioning.whatPreventsStrongerPositioning : ['More independent evidence is needed.'],
  });
  const advantage = competitiveAdvantages.find((item) => item.statement.startsWith('Grounded capabilities')) ?? competitiveAdvantages[0] ?? insight({
    kind: 'takeaway',
    statement: 'No competitive advantage is established by the current snapshot.',
    scope: 'insufficient',
    strength: 'weak',
    confidence: 'low',
    evidenceIds: [],
    limitations: ['The snapshot does not contain enough repeated evidence.'],
  });
  const growthOpportunity = growthAreas[0] ?? insight({
    kind: 'growth_area',
    statement: 'No evidence-backed development gap is established from the current snapshot.',
    scope: 'insufficient',
    strength: 'weak',
    confidence: 'low',
    evidenceIds: [],
    limitations: ['More applicant-specific information is needed before a targeted development recommendation is defensible.'],
    currentGap: 'A specific capability or positioning gap is not established yet.',
    importance: 'A targeted recommendation should follow the evidence rather than assume a weakness.',
    direction: 'Add a reflected experience or clarify the intended direction before selecting a development priority.',
  });

  const fallbackCoverage = {
    strongEvidence: Array.from(
      new Set(
        proofOfMe.cards
          .filter((card) => card.evidenceStrength === 'strong')
          .flatMap((card) => card.evidenceRefs.map((ref) => ref.id)),
      ),
    ),
    weakEvidence: Array.from(
      new Set(
        proofOfMe.cards
          .filter((card) => card.evidenceStrength !== 'strong')
          .flatMap((card) => card.evidenceRefs.map((ref) => ref.id)),
      ),
    ),
    insufficientEvidence: Array.from(new Set(growthAreas.map((area) => area.currentGap || area.statement))),
  } satisfies PersonalReportEvidenceCoverage;

  return {
    growthAreas,
    competitiveAdvantages,
    keyTakeaways: {
      whatMakesYouStandOut: standout,
      competitiveAdvantage: advantage,
      growthOpportunity,
    },
    evidenceCoverage: args.evidenceBank
      ? evidenceCoverageFromBank(args.evidenceBank, fallbackCoverage)
      : fallbackCoverage,
  };
}

/**
 * The "Your profile at a glance" synopsis (implementation spec §5) —
 * deterministic by default so the block never has nothing to show; narrative
 * synthesis (`src/lib/ai/personal-report-narrative-synthesis.ts`) overwrites
 * it with better-written prose over these exact same facts when it succeeds.
 */
function buildOverview(
  coreIdentity: CoreIdentitySection,
  drivingForce: DrivingForceSection,
  emergingThemes: EmergingThemesSection,
): ReportOverview | null {
  if (!coreIdentity.available && !drivingForce.available && !emergingThemes.available) return null;

  const parts: string[] = [];
  const evidenceRefs: EvidenceRef[] = [];

  if (coreIdentity.available && coreIdentity.headline) {
    parts.push(`${coreIdentity.headline}.`);
    evidenceRefs.push(...coreIdentity.evidenceRefs);
  }
  if (drivingForce.available && drivingForce.repeatedMotivations.length > 0) {
    parts.push(
      drivingForce.isHypothesis
        ? 'Their choices repeatedly point toward a motivation that is still an emerging hypothesis rather than a confirmed fact.'
        : 'They have clearly explained what motivates these choices.',
    );
    evidenceRefs.push(...drivingForce.evidenceRefs);
  }
  const topTheme = emergingThemes.available ? emergingThemes.themes[0] : null;
  if (topTheme) {
    parts.push(`Their strongest emerging theme is "${topTheme.theme}".`);
    evidenceRefs.push(...topTheme.evidenceRefs);
  }

  if (parts.length === 0) return null;
  return { summary: parts.join(' '), evidenceRefs };
}

/**
 * "What this report suggests overall" — deterministic by default, appears at
 * the end of Proof of Me. Never an action plan (spec §18: that belongs to the
 * Strategy Report), just the strongest signal, the key emerging signal, and
 * the biggest limitation, all already computed by the sections above.
 */
function buildOverallSummary(
  coreIdentity: CoreIdentitySection,
  emergingThemes: EmergingThemesSection,
  proofOfMe: ProofOfMeSection,
): ReportOverallSummary {
  const paragraphs: string[] = [];
  const evidenceRefs: EvidenceRef[] = [];

  const strongestCard = proofOfMe.cards.find((card) => card.evidenceStrength === 'strong');
  if (strongestCard) {
    paragraphs.push(`The strongest evidence-backed signal is "${strongestCard.title}".`);
    evidenceRefs.push(...strongestCard.evidenceRefs);
  } else if (coreIdentity.observedBehaviours?.[0]) {
    paragraphs.push(`The clearest observed signal is "${coreIdentity.observedBehaviours[0]}"; it remains an observation rather than a recurring identity claim.`);
    evidenceRefs.push(...coreIdentity.evidenceRefs);
  }
  const topTheme = emergingThemes.available ? emergingThemes.themes[0] : null;
  if (topTheme) {
    paragraphs.push(`"${topTheme.theme}" is the clearest emerging theme so far.`);
    evidenceRefs.push(...topTheme.evidenceRefs);
  }
  const limitedCount = proofOfMe.cards.filter((card) => card.evidenceStrength === 'limited').length;
  if (limitedCount > 0) {
    paragraphs.push(
      `${limitedCount} piece${limitedCount === 1 ? '' : 's'} of evidence still ${limitedCount === 1 ? 'has' : 'have'} limited support — attaching documents or more detail would strengthen ${limitedCount === 1 ? 'it' : 'them'}.`,
    );
  } else if (coreIdentity.stillDeveloping.length > 0) {
    paragraphs.push(coreIdentity.stillDeveloping[0] as string);
  }

  if (paragraphs.length === 0) {
    paragraphs.push('No applicant-specific overall conclusion is established from the available records yet. Add a concrete activity, reflection, or supporting evidence to make the profile more interpretable.');
  }
  return { paragraphs, evidenceRefs };
}

export type PersonalReportV2 = {
  generatedAt: string;
  overallEvidenceConfidence: ReportConfidence;
  coreIdentity: CoreIdentitySection;
  drivingForce: DrivingForceSection;
  signaturePattern: SignaturePatternSection;
  emergingThemes: EmergingThemesSection;
  personalPositioning: PersonalPositioningSection;
  proofOfMe: ProofOfMeSection;
  /**
   * Deterministic chart data (implementation spec §24) — every graph on the
   * report reads only from here, never computes its own number. Optional,
   * not because a fresh report can omit it (`buildPersonalReport` always sets
   * it), but because a report VERSION generated before this field existed is
   * still a valid stored `PersonalReportV2` snapshot with no way to backfill
   * it (the raw activities behind an old version were never persisted,
   * only the evaluation). Rendering an old version without analytics shows
   * an honest "not available for this version" state, never a crash.
   */
  analytics?: PersonalReportAnalytics;
  /** "Your profile at a glance" synopsis — see `buildOverview`. Same optionality reasoning as `analytics`. */
  overview?: ReportOverview | null;
  /** "What this report suggests overall", shown at the end of Proof of Me — see `buildOverallSummary`. */
  overallSummary?: ReportOverallSummary | null;
  /** Application-scoped additive contract; legacy stored versions may omit it. */
  snapshot?: { summary: string };
  growthAreas?: PersonalReportInsight[];
  competitiveAdvantages?: PersonalReportInsight[];
  keyTakeaways?: PersonalReportKeyTakeaways;
  /** Structured reflection meaning; raw Q1-Q7 answers are never stored here. */
  reflectionFindings?: ReflectionFinding[];
  /** Deterministic repeated/isolated status for each persisted structured finding. */
  reflectionFindingStatuses?: Partial<Record<ReflectionAnswerKey, 'repeated' | 'isolated'>>;
  /** Applicant-facing narrative contract; legacy prose fields remain additive. */
  narrativeDetails?: PersonalReportNarrativeDetails;
  /** Independent structural/evidence coverage measured on the assembled report. */
  frameworkCoverage?: PersonalReportFrameworkCoverage;
  evidenceCoverage?: PersonalReportEvidenceCoverage;
  limitations?: string[];
  canvasDetails?: PersonalCanvasDetails;
};

export type FrameworkSectionStatus = 'supported' | 'emerging' | 'needs_more_evidence' | 'unavailable';

export type FrameworkComponentKey =
  | 'applicantSnapshot'
  | 'overallIdentity'
  | 'uniquePositioning'
  | 'mostProminentPattern'
  | 'potentialDevelopmentDirection'
  | 'overallImpression'
  | 'coreIdentity'
  | 'identityStatement'
  | 'definingTraits'
  | 'drivingForces'
  | 'motivationLandscape'
  | 'primaryMotivation'
  | 'repeatedChoices'
  | 'recurringProblems'
  | 'decisionMaking'
  | 'underlyingValues'
  | 'strategicInterpretation'
  | 'provenCapabilities'
  | 'capabilityOverview'
  | 'capabilityProfile'
  | 'capabilityCombinationInsight'
  | 'socialProof'
  | 'socialProofConclusion'
  | 'profilePositioning'
  | 'experienceConnection'
  | 'positioningOptions'
  | 'profileNarrative'
  | 'keyTakeaways'
  | 'whatMakesYouStandOut'
  | 'competitiveAdvantage'
  | 'growthOpportunity'
  | 'areasForGrowth'
  | 'longTermVision';

export type FrameworkSectionCoverage = {
  status: FrameworkSectionStatus;
  evidenceIds: string[];
  structuralPresent: boolean;
  contentComplete: boolean;
  evidenceSufficient: boolean;
  groundingValid: boolean;
};

export type PersonalReportFrameworkCoverage = {
  structuralCompleteness: { complete: boolean; missing: FrameworkComponentKey[] };
  contentCompleteness: { complete: boolean; missing: FrameworkComponentKey[] };
  evidenceCoverage: { supported: number; emerging: number; needsMoreEvidence: number; unavailable: number };
  narrativeGeneration: { status: 'complete' | 'partial' | 'deterministic_fallback'; generatedSections: string[] };
  groundingValidity: { valid: boolean; invalidEvidenceIds: string[] };
  renderingCompleteness: { complete: boolean; interactive: boolean; print: boolean; missing: FrameworkComponentKey[] };
  applicantSpecificContentQuality: 'specific' | 'limited' | 'unavailable';
  sections: Record<FrameworkComponentKey, FrameworkSectionCoverage>;
};

function frameworkStatus(args: {
  substantive: boolean;
  limited: boolean;
  evidenceIds?: readonly string[];
}): FrameworkSectionStatus {
  if (!args.substantive && !args.limited) return 'unavailable';
  if (args.substantive && (args.evidenceIds?.length ?? 0) > 0) return 'supported';
  if (args.substantive) return 'emerging';
  if (args.limited) return 'needs_more_evidence';
  return 'needs_more_evidence';
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function hasExplicitLimitation(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const section = value as Record<string, unknown>;
  const insufficient = section.insufficientData;
  if (
    insufficient &&
    typeof insufficient === 'object' &&
    !Array.isArray(insufficient) &&
    hasText((insufficient as Record<string, unknown>).reason) &&
    hasItems((insufficient as Record<string, unknown>).actions)
  ) return true;
  return [section.limitations, section.stillDeveloping, section.whatPreventsStrongerPositioning]
    .some((candidate) => hasItems(candidate));
}

function hasInsightContent(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const insight = value as Record<string, unknown>;
  return hasText(insight.statement) || hasText(insight.insight) || hasText(insight.advantageStatement) || hasText(insight.growthArea);
}

/**
 * Validates the assembled report contract without inspecting React or print
 * markup. Empty evidence is a valid report state; a missing component is not.
 */
export function validatePersonalReportFramework(report: PersonalReportV2): PersonalReportFrameworkCoverage {
  const coreIdentity = report.coreIdentity as Partial<CoreIdentitySection> | undefined;
  const drivingForce = report.drivingForce as Partial<DrivingForceSection> | undefined;
  const signaturePattern = report.signaturePattern as Partial<SignaturePatternSection> | undefined;
  const emergingThemes = report.emergingThemes as Partial<EmergingThemesSection> | undefined;
  const personalPositioning = report.personalPositioning as Partial<PersonalPositioningSection> | undefined;
  const proofOfMe = report.proofOfMe as Partial<ProofOfMeSection> | undefined;
  const coreEvidenceRefs = coreIdentity?.evidenceRefs ?? [];
  const drivingEvidenceRefs = drivingForce?.evidenceRefs ?? [];
  const signatureEvidenceRefs = signaturePattern?.evidenceRefs ?? [];
  const positioningEvidenceRefs = personalPositioning?.evidenceRefs ?? [];
  const proofCards = proofOfMe?.cards ?? [];
  const refIds = [
    ...coreEvidenceRefs,
    ...drivingEvidenceRefs,
    ...signatureEvidenceRefs,
    ...(emergingThemes?.themes ?? []).flatMap((theme) => theme.evidenceRefs),
    ...positioningEvidenceRefs,
    ...proofCards.flatMap((card) => card.evidenceRefs),
    ...(report.canvasDetails?.socialProof ?? []).flatMap((metric) => metric.evidenceIds.map((id) => ({ id }))),
  ].map((ref) => ref.id);
  const allowed = new Set(refIds);
  const narrative = report.narrativeDetails;
  const traitEvidence = narrative?.coreIdentity?.definingTraits.flatMap((trait) => trait.evidenceIds) ?? [];
  const capabilityEvidence = narrative?.provenCapabilities?.capabilities.flatMap((capability) => capability.evidenceIds) ?? [];
  const socialEvidence = narrative?.socialProof?.evidenceIds ?? [];
  const positioningEvidence = narrative?.profilePositioning?.profileNarrativeEvidenceIds ?? [];
  const takeawaysEvidence = [
    ...(narrative?.keyTakeaways?.whatMakesYouStandOut.evidenceIds ?? []),
    ...(narrative?.keyTakeaways?.competitiveAdvantage.evidenceIds ?? []),
    ...(narrative?.keyTakeaways?.growthOpportunity.evidenceIds ?? []),
  ];
  const idsFor = (...groups: readonly string[][]) => [...new Set(groups.flat())];
  const hasCanvas = Boolean(report.canvasDetails && typeof report.canvasDetails === 'object');
  const hasCapabilities = (report.canvasDetails?.capabilities?.length ?? 0) > 0;
  const hasSocialProof = report.canvasDetails?.socialProof?.some((metric) =>
    APPLICANT_IMPACT_METRIC_KEYS.has(metric.key) && metric.value > 0 && metric.evidenceIds.length > 0,
  ) ?? false;
  const hasTraits = Boolean(narrative?.coreIdentity?.definingTraits.length || coreIdentity?.observedBehaviours?.length || coreIdentity?.recurringBehaviours?.length);
  const identitySubstantive = Boolean(narrative?.coreIdentity?.identityStatement || coreIdentity?.headline || coreIdentity?.interpretation);
  const positioningSubstantive = Boolean(narrative?.profilePositioning?.profileNarrative || personalPositioning?.statement);
  const futurePathways = report.canvasDetails?.futurePathways ?? [];
  const growthAreas = report.growthAreas ?? [];
  const keyTakeawayLimitation = hasExplicitLimitation(report.keyTakeaways);
  const section = (
    substantive: boolean,
    limited: boolean,
    evidenceIds: readonly string[],
  ): FrameworkSectionCoverage => {
    const structuralPresent = substantive || limited;
    const uniqueEvidenceIds = [...new Set(evidenceIds)];
    return {
      status: frameworkStatus({ substantive, limited, evidenceIds: uniqueEvidenceIds }),
      evidenceIds: uniqueEvidenceIds,
      structuralPresent,
      contentComplete: structuralPresent,
      evidenceSufficient: substantive,
      groundingValid: true,
    };
  };
  const sections = {
    applicantSnapshot: section(Boolean(hasText(report.snapshot?.summary) || hasText(narrative?.snapshot)), false, idsFor(coreEvidenceRefs.map((ref) => ref.id), proofCards.flatMap((card) => card.evidenceRefs.map((ref) => ref.id)))),
    overallIdentity: section(identitySubstantive, hasExplicitLimitation(coreIdentity), coreEvidenceRefs.map((ref) => ref.id)),
    uniquePositioning: section(positioningSubstantive, hasExplicitLimitation(personalPositioning), positioningEvidenceRefs.map((ref) => ref.id)),
    mostProminentPattern: section(Boolean(signaturePattern?.steps && hasItems(signaturePattern.steps)), hasExplicitLimitation(signaturePattern), signatureEvidenceRefs.map((ref) => ref.id)),
    potentialDevelopmentDirection: section(Boolean(hasItems(futurePathways) || hasItems(growthAreas)), hasCanvas || hasExplicitLimitation(personalPositioning), idsFor(growthAreas.flatMap((area) => area.evidenceIds), positioningEvidenceRefs.map((ref) => ref.id))),
    overallImpression: section(Boolean(hasItems(report.overallSummary?.paragraphs)), hasExplicitLimitation(report), report.overallSummary?.evidenceRefs?.map((ref) => ref.id) ?? []),
    coreIdentity: section(identitySubstantive, hasExplicitLimitation(coreIdentity), coreEvidenceRefs.map((ref) => ref.id)),
    identityStatement: section(identitySubstantive, hasExplicitLimitation(coreIdentity), coreEvidenceRefs.map((ref) => ref.id)),
    definingTraits: section(hasTraits, hasExplicitLimitation(coreIdentity), idsFor(traitEvidence, coreEvidenceRefs.map((ref) => ref.id))),
    drivingForces: section(Boolean(drivingForce?.available || drivingForce?.primaryMotivation), hasExplicitLimitation(drivingForce), drivingEvidenceRefs.map((ref) => ref.id)),
    motivationLandscape: section(Boolean(narrative?.drivingForce || drivingForce?.repeatedMotivations?.length || drivingForce?.primaryMotivation), hasExplicitLimitation(drivingForce), drivingEvidenceRefs.map((ref) => ref.id)),
    primaryMotivation: section(Boolean(narrative?.drivingForce?.primaryMotivation || drivingForce?.primaryMotivation), hasExplicitLimitation(drivingForce), drivingEvidenceRefs.map((ref) => ref.id)),
    repeatedChoices: section(Boolean(narrative?.drivingForce?.repeatedChoices.length || drivingForce?.repeatedChoices?.length), hasExplicitLimitation(drivingForce), drivingEvidenceRefs.map((ref) => ref.id)),
    recurringProblems: section(Boolean(narrative?.drivingForce?.recurringProblems.length || drivingForce?.recurringProblems?.length), hasExplicitLimitation(drivingForce), drivingEvidenceRefs.map((ref) => ref.id)),
    decisionMaking: section(Boolean(narrative?.drivingForce?.decisionMaking || drivingForce?.decisionMaking), hasExplicitLimitation(drivingForce), drivingEvidenceRefs.map((ref) => ref.id)),
    underlyingValues: section(Boolean(narrative?.drivingForce?.underlyingValues.length || drivingForce?.underlyingValues?.length), hasExplicitLimitation(drivingForce), drivingEvidenceRefs.map((ref) => ref.id)),
    strategicInterpretation: section(Boolean(narrative?.drivingForce?.strategicInterpretation || drivingForce?.strategicInterpretation), hasExplicitLimitation(drivingForce), drivingEvidenceRefs.map((ref) => ref.id)),
    provenCapabilities: section(hasCapabilities, hasCanvas, capabilityEvidence),
    capabilityOverview: section(Boolean(narrative?.provenCapabilities?.overview || hasCapabilities), hasCanvas, capabilityEvidence),
    capabilityProfile: section(hasCapabilities, hasCanvas, capabilityEvidence),
    capabilityCombinationInsight: section(Boolean(narrative?.provenCapabilities?.combinationInsight || hasCapabilities), hasCanvas, capabilityEvidence),
    socialProof: section(hasSocialProof, hasCanvas, socialEvidence),
    socialProofConclusion: section(Boolean(narrative?.socialProof?.conclusion || hasSocialProof), hasCanvas, socialEvidence),
    profilePositioning: section(positioningSubstantive, hasExplicitLimitation(personalPositioning), positioningEvidenceRefs.map((ref) => ref.id)),
    experienceConnection: section(Boolean(narrative?.profilePositioning?.experienceConnection || hasItems(personalPositioning?.whyThisFits)), hasExplicitLimitation(personalPositioning), positioningEvidence),
    positioningOptions: section(Boolean(narrative?.profilePositioning?.positioningOptions.length), hasExplicitLimitation(personalPositioning), positioningEvidence),
    profileNarrative: section(positioningSubstantive, hasExplicitLimitation(personalPositioning), positioningEvidence),
    keyTakeaways: section(Boolean(report.keyTakeaways && Object.values(report.keyTakeaways).every(hasInsightContent)), hasExplicitLimitation(report.keyTakeaways), takeawaysEvidence),
    whatMakesYouStandOut: section(hasInsightContent(report.keyTakeaways?.whatMakesYouStandOut), keyTakeawayLimitation, report.keyTakeaways?.whatMakesYouStandOut?.evidenceIds ?? []),
    competitiveAdvantage: section(hasInsightContent(report.keyTakeaways?.competitiveAdvantage), keyTakeawayLimitation, report.keyTakeaways?.competitiveAdvantage?.evidenceIds ?? []),
    growthOpportunity: section(hasInsightContent(report.keyTakeaways?.growthOpportunity), keyTakeawayLimitation, report.keyTakeaways?.growthOpportunity?.evidenceIds ?? []),
    areasForGrowth: section(Boolean(hasItems(growthAreas)), hasExplicitLimitation(report), growthAreas.flatMap((area) => area.evidenceIds)),
    longTermVision: section(Boolean(hasItems(futurePathways)), hasCanvas, []),
  } satisfies Record<FrameworkComponentKey, FrameworkSectionCoverage>;
  const missing = (Object.entries(sections) as Array<[FrameworkComponentKey, FrameworkSectionCoverage]>)
    .filter(([, value]) => !value.structuralPresent)
    .map(([key]) => key);
  const contentMissing = (Object.entries(sections) as Array<[FrameworkComponentKey, FrameworkSectionCoverage]>)
    .filter(([, value]) => !value.contentComplete)
    .map(([key]) => key);
  const statuses = Object.values(sections).reduce((counts, section) => {
    if (section.status === 'supported') counts.supported += 1;
    if (section.status === 'emerging') counts.emerging += 1;
    if (section.status === 'needs_more_evidence') counts.needsMoreEvidence += 1;
    if (section.status === 'unavailable') counts.unavailable += 1;
    return counts;
  }, { supported: 0, emerging: 0, needsMoreEvidence: 0, unavailable: 0 });
  const narrativeSections = Object.keys(narrative ?? {});
  const narrativeIds = [...traitEvidence, ...capabilityEvidence, ...socialEvidence, ...positioningEvidence, ...takeawaysEvidence];
  const invalidEvidenceIds = [...new Set(narrativeIds.filter((id) => !allowed.has(id)))];
  for (const value of Object.values(sections)) {
    value.groundingValid = value.evidenceIds.every((id) => !invalidEvidenceIds.includes(id));
  }
  const evidencedSections = Object.values(sections).filter((value) => value.evidenceIds.length > 0 && value.evidenceSufficient).length;
  return {
    structuralCompleteness: { complete: missing.length === 0, missing },
    contentCompleteness: { complete: contentMissing.length === 0, missing: contentMissing },
    evidenceCoverage: statuses,
    narrativeGeneration: {
      // The structured narrative contract has seven top-level parts. Six is
      // still partial; deterministic Canvas prose remains the framework
      // fallback when any model-authored part is unavailable.
      status: narrativeSections.length === 7 ? 'complete' : narrativeSections.length > 0 ? 'partial' : 'deterministic_fallback',
      generatedSections: narrativeSections,
    },
    groundingValidity: { valid: invalidEvidenceIds.length === 0, invalidEvidenceIds },
    renderingCompleteness: { complete: true, interactive: true, print: true, missing: [] },
    applicantSpecificContentQuality: evidencedSections >= 8 ? 'specific' : evidencedSections > 0 ? 'limited' : 'unavailable',
    sections,
  };
}

const storedReportSectionSchema = z.object({ available: z.boolean().optional() }).passthrough();

/** Runtime contract for append-only stored reports; optional fields preserve legacy versions. */
export const personalReportV2Schema = z.preprocess((value) => {
  if (!value || typeof value !== 'object') return value;
  const record = { ...(value as Record<string, unknown>) };
  // Archived pre-v2 rows used scalar section placeholders and a numeric
  // confidence. Normalize only those known legacy shapes before validation.
  for (const key of ['coreIdentity', 'drivingForce', 'signaturePattern', 'emergingThemes', 'personalPositioning', 'proofOfMe']) {
    if (!record[key] || typeof record[key] !== 'object' || Array.isArray(record[key])) record[key] = {};
  }
  if (typeof record.overallEvidenceConfidence === 'number') {
    record.overallEvidenceConfidence = record.overallEvidenceConfidence >= 75 ? 'high' : record.overallEvidenceConfidence >= 50 ? 'medium' : 'low';
  }
  return record;
}, z.object({
  generatedAt: z.string().min(1).optional(),
  overallEvidenceConfidence: z.enum(['high', 'medium', 'low']),
  coreIdentity: storedReportSectionSchema,
  drivingForce: storedReportSectionSchema,
  signaturePattern: storedReportSectionSchema,
  emergingThemes: storedReportSectionSchema,
  personalPositioning: storedReportSectionSchema,
  proofOfMe: storedReportSectionSchema,
}).passthrough());

export function buildPersonalReport(args: {
  evaluation: ProfileEvaluation;
  activities: readonly NarrativeActivity[];
  intendedDirection: string | null;
  generatedAt: string;
  evidenceBank?: EvidenceBank;
}): PersonalReportV2 {
  const { evaluation, activities, intendedDirection, generatedAt, evidenceBank } = args;
  const themes = themeMaturityResults(activities);
  const coreIdentity = buildCoreIdentity(evaluation, activities);
  const drivingForce = buildDrivingForce(evaluation, activities);
  const signaturePattern = buildSignaturePattern(evaluation, activities);
  const emergingThemes = buildEmergingThemes(activities, themes, evaluation.reflectionAnswerSignals);
  const proofOfMe = buildProofOfMe(evaluation, activities, themes);
  const personalPositioning = buildPersonalPositioning(
    evaluation,
    themes,
    intendedDirection,
    evaluation.reflectionAnswerSignals,
  );
  const applicationInsights = buildApplicationInsights({
    evaluation,
    coreIdentity,
    drivingForce,
    signaturePattern,
    personalPositioning,
    proofOfMe,
    intendedDirection,
    ...(evaluation.reflectionAnswerSignals !== undefined
      ? { reflectionAnswerSignals: evaluation.reflectionAnswerSignals }
      : {}),
    ...(evidenceBank ? { evidenceBank } : {}),
  });

  return {
    generatedAt,
    overallEvidenceConfidence: evaluation.confidence,
    coreIdentity,
    drivingForce,
    signaturePattern,
    emergingThemes,
    personalPositioning,
    proofOfMe,
    analytics: buildPersonalReportAnalytics({
      evaluation,
      signaturePatternSteps: signaturePattern.steps,
      supportingExperienceCount: signaturePattern.supportingExperienceCount,
      signaturePatternConfidence: signaturePattern.confidence,
      emergingThemes: emergingThemes.themes,
      proofStrengthCounts: proofOfMeStrengthCounts(evaluation, activities),
    }),
    overview: buildOverview(coreIdentity, drivingForce, emergingThemes),
    overallSummary: buildOverallSummary(coreIdentity, emergingThemes, proofOfMe),
    snapshot: {
      summary: snapshotSummary(
        coreIdentity,
        drivingForce,
        signaturePattern,
        proofOfMe,
        personalPositioning,
        applicationInsights.growthAreas,
      ),
    },
    reflectionFindings: evaluation.reflectionAnswerSignals?.flatMap((signal) => signal.finding ? [signal.finding] : []) ?? [],
    reflectionFindingStatuses: Object.fromEntries(
      (evaluation.reflectionAnswerSignals ?? []).map((signal) => [signal.key, signal.status]),
    ) as Partial<Record<ReflectionAnswerKey, 'repeated' | 'isolated'>>,
    ...applicationInsights,
    limitations: applicationInsights.growthAreas.flatMap((area) => area.limitations),
  };
}
