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
  type ThemeMaturityResult,
} from '@/shared/evaluation';

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

  const recurringBehaviours = activities
    .map((activity) => activity.behaviour)
    .filter((behaviour): behaviour is string => Boolean(behaviour))
    .slice(0, 4);

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

  const repeatedMotivations = activities
    .map((activity) => activity.statedMotivation)
    .filter((value): value is string => Boolean(value))
    .slice(0, 4);

  if (!available) {
    return {
      available: false,
      headline: null,
      explanation: null,
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
    explanationParts.push(`The candidate has clearly stated their motivation: "${statedMotivation}".`);
  } else {
    explanationParts.push(
      'The candidate has not clearly stated their motivation; the finding below is inferred only from a repeated pattern of activity choices, and is therefore an EMERGING HYPOTHESIS, not a confirmed fact.',
    );
  }
  if (recurrenceCount >= 2) {
    explanationParts.push(`The candidate explained their reasoning across ${recurrenceCount} matching pieces of evidence.`);
  }

  return {
    available: true,
    headline,
    explanation: explanationParts.join(' '),
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
): EmergingThemesSection {
  if (themes.length === 0) {
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

export type PersonalPositioningSection = {
  available: boolean;
  statement: string | null;
  positioningStatus: ApplicantPositioning['positioningStatus'];
  authentic: boolean;
  differentiated: boolean;
  coherent: boolean;
  directionAligned: boolean;
  credible: boolean;
  whatPreventsStrongerPositioning: string[];
  confidence: ReportConfidence;
  evidenceRefs: EvidenceRef[];
  insufficientData: InsufficientData | null;
};

function buildPersonalPositioning(
  evaluation: ProfileEvaluation,
  themes: readonly ThemeMaturityResult[],
  intendedDirection: string | null,
): PersonalPositioningSection {
  const { identity, pattern } = evaluation.narrativeIdentity;
  const topTheme = [...themes].sort((a, b) => b.evidenceCount - a.evidenceCount)[0] ?? null;
  const coherent = identity.kind !== 'missing' && pattern.pattern !== null && (topTheme === null || topTheme.evidenceCount > 0);

  const positioning = assessApplicantPositioning({
    identity,
    pattern,
    theme: topTheme,
    intendedDirection,
    coherent,
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
    whatPreventsStrongerPositioning: positioning.limitations,
    confidence: positioning.confidence,
    evidenceRefs: positioning.evidenceRefs,
    insufficientData: null,
  };
}

export type ProofCard = {
  activityId: string;
  title: string;
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

  const competenciesByActivity = new Map<string, string[]>();
  for (const claim of evaluation.competencies.claims) {
    for (const ref of claim.evidenceRefs) {
      const existing = competenciesByActivity.get(ref.id) ?? [];
      if (!existing.includes(claim.label)) existing.push(claim.label);
      competenciesByActivity.set(ref.id, existing);
    }
  }

  const proofs = buildEvidenceToIdentityMap(activities, competenciesByActivity);
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));

  const cards: ProofCard[] = proofs.slice(0, 12).map((proof) => {
    const activity = activityById.get(proof.activityId);
    const { tier, source } = verificationFor(proof, evaluation);
    return {
      activityId: proof.activityId,
      title: proof.title,
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

export type PersonalReportV2 = {
  generatedAt: string;
  overallEvidenceConfidence: ReportConfidence;
  coreIdentity: CoreIdentitySection;
  drivingForce: DrivingForceSection;
  signaturePattern: SignaturePatternSection;
  emergingThemes: EmergingThemesSection;
  personalPositioning: PersonalPositioningSection;
  proofOfMe: ProofOfMeSection;
};

export function buildPersonalReport(args: {
  evaluation: ProfileEvaluation;
  activities: readonly NarrativeActivity[];
  intendedDirection: string | null;
  generatedAt: string;
}): PersonalReportV2 {
  const { evaluation, activities, intendedDirection, generatedAt } = args;
  const themes = themeMaturityResults(activities);

  return {
    generatedAt,
    overallEvidenceConfidence: evaluation.confidence,
    coreIdentity: buildCoreIdentity(evaluation, activities),
    drivingForce: buildDrivingForce(evaluation, activities),
    signaturePattern: buildSignaturePattern(evaluation, activities),
    emergingThemes: buildEmergingThemes(activities, themes),
    personalPositioning: buildPersonalPositioning(evaluation, themes, intendedDirection),
    proofOfMe: buildProofOfMe(evaluation, activities, themes),
  };
}
