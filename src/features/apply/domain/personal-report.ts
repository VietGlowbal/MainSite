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
};

export type InsufficientData = {
  reason: string;
  actions: IntakeAction[];
};

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

function answerReflectionAction(label: string): IntakeAction {
  return { kind: 'answer_reflection_question', label, href: REFLECTION_HREF };
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
        ? 'Hồ sơ hiện có ít hơn hai hoạt động độc lập, nên chưa thể xác lập một vai trò hay hành vi lặp lại.'
        : 'Các hoạt động hiện có chưa mô tả rõ vai trò hoặc hành động cụ thể, nên chưa thể nhận diện một mẫu hình nhất quán.';
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
    ? `Người ${recurringBehaviour.charAt(0).toLowerCase()}${recurringBehaviour.slice(1)}`
    : recurringRole
      ? `Người thường đóng vai trò ${recurringRole}`
      : 'Một mẫu hình đang hình thành';

  const interpretationParts: string[] = [];
  if (recurringRole) interpretationParts.push(`Trong nhiều hoạt động, ứng viên lặp lại vai trò "${recurringRole}".`);
  if (recurringBehaviour) interpretationParts.push(`Hành vi lặp lại rõ nhất là: ${recurringBehaviour.toLowerCase()}.`);
  if (valueOrientation) {
    interpretationParts.push(`Giá trị mà hành vi này hướng tới là "${valueOrientation}".`);
  } else {
    interpretationParts.push('Định hướng giá trị phía sau mẫu hình này vẫn cần thêm hoạt động để khẳng định.');
  }
  interpretationParts.push(
    readiness.level === 'mature'
      ? 'Đây là một quan sát dựa trên ba hoạt động độc lập trở lên.'
      : 'Đây vẫn là một mẫu hình đang hình thành — cần thêm hoạt động để trở thành một nhận định chắc chắn.',
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
        reason: 'Chưa có đủ hoạt động hoặc động lực được nêu rõ để xác định điều gì thực sự thúc đẩy ứng viên.',
        actions: [
          addActivityAction(),
          answerReflectionAction('Explain why you are interested in these subjects'),
        ],
      },
    };
  }

  const headline = isHypothesis
    ? 'Một giả thuyết đang hình thành về động lực'
    : statedMotivation
      ? 'Động lực đã được xác nhận rõ ràng'
      : 'Động lực đang dần rõ nét';

  const explanationParts: string[] = [];
  if (statedMotivation) {
    explanationParts.push(`Ứng viên đã nói rõ động lực của mình: "${statedMotivation}".`);
  } else {
    explanationParts.push(
      'Ứng viên chưa nói rõ động lực của mình; nhận định dưới đây chỉ được suy ra từ việc lựa chọn hoạt động lặp lại nhiều lần, và vì vậy chỉ là một GIẢ THUYẾT ĐANG HÌNH THÀNH, không phải một sự thật đã được xác nhận.',
    );
  }
  if (recurrenceCount >= 2) {
    explanationParts.push(`Ứng viên đã giải thích lý do của mình ở ${recurrenceCount} nguồn bằng chứng phù hợp.`);
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
      : 'Ứng viên chưa từng nói rõ vì sao mình chọn những hoạt động này — nhận định hiện tại chỉ dựa trên sự lặp lại.',
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
  trigger: 'Điều khiến ứng viên bắt đầu',
  response: 'Vai trò họ đảm nhận',
  method: 'Cách họ thực hiện',
  valueCreated: 'Giá trị tạo ra',
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
            ? 'Cần ít nhất hai hoạt động độc lập để nhận diện một chuỗi hành vi lặp lại.'
            : 'Các hoạt động hiện có chưa cho thấy một trình tự hành vi nhất quán (điều gì khiến bạn bắt đầu, vai trò, cách làm, và kết quả).',
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
      ? 'Sự kết hợp giữa nhiều chủ đề khác nhau và một vai trò nhất quán là điều khiến mẫu hình này trở nên khác biệt, chứ không chỉ là một hoạt động lặp lại.'
      : 'Mẫu hình này hiện vẫn giới hạn trong một phạm vi hẹp — cần thêm hoạt động ở các chủ đề khác để trở nên khác biệt rõ rệt hơn.';

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
        reason: 'Chưa có hoạt động nào được gắn với một chủ đề hay lĩnh vực quan tâm rõ ràng.',
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
          ? 'Chủ đề này đã được xác lập rõ ràng qua nhiều hoạt động.'
          : `Cần thêm hoạt động rõ ràng gắn với "${theme.theme}" để chủ đề này trở nên chắc chắn hơn.`;

      return {
        theme: theme.theme,
        status: theme.status,
        statusLabel: THEME_MATURITY_LABEL[theme.status],
        explanation: `Ứng viên đã thể hiện sự quan tâm đến "${theme.theme}" qua ${theme.evidenceCount} hoạt động.`,
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
        reason: 'Chưa có chủ đề nào xuất hiện đủ rõ để ghi nhận là một xu hướng đang hình thành.',
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
        reason: 'Chưa có đủ dữ liệu về vai trò, mẫu hình hành vi hoặc chủ đề quan tâm để xây dựng một tuyên bố định vị.',
        actions: [addActivityAction(), expandReflectionAction()],
      },
    };
  }

  const statementParts: string[] = [];
  if (positioning.identity) statementParts.push(`là người ${positioning.identity.toLowerCase()}`);
  if (positioning.signatureStrength) statementParts.push(`tạo giá trị bằng cách ${positioning.signatureStrength.toLowerCase()}`);
  if (positioning.theme) statementParts.push(`quan tâm sâu sắc đến "${positioning.theme}"`);
  if (positioning.intendedDirection) statementParts.push(`đang hướng tới ${positioning.intendedDirection.toLowerCase()}`);

  const statement =
    statementParts.length > 0
      ? `Ứng viên ${statementParts.join(', ')}.`
      : 'Chưa đủ dữ liệu để phát biểu một tuyên bố định vị đầy đủ.';

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
        reason: 'Chưa có hoạt động hay thành tích nào được ghi nhận.',
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
