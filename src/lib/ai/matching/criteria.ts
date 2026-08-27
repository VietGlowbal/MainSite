import type { TargetProfile, TargetRequirement } from '@/lib/ai/target-profile/domain';
import type {
  CriterionCategory,
  CriterionImportance,
  MatchingCriterion,
  RequirementType,
} from './domain';

type CriterionDraft = Omit<MatchingCriterion, 'id'> & {
  identityLabel: string;
  sourceIdentity: string | null;
};

const CATEGORY_ORDER: CriterionCategory[] = [
  'academic_requirement',
  'academic_preparation',
  'competency',
  'selection_criterion',
  'programme_value',
  'motivation',
  'experience',
  'scholarship',
];

/**
 * Stable, accent-insensitive tokens used for IDs and deterministic prompts.
 * No model call is involved in criterion preparation.
 */
export function normalizeCriterionText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function stableCriterionSlug(value: string): string {
  return normalizeCriterionText(value).replace(/ /g, '-');
}

function tokens(value: string): string[] {
  return Array.from(new Set(normalizeCriterionText(value).split(' ').filter(Boolean)));
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort(compareLexical);
}

function compareLexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requiredLanguage(requirement: TargetRequirement): boolean {
  if (requirement.status === 'required') return true;
  return /\b(required|mandatory|minimum|min\.?|must|at least)\b/i.test(
    `${requirement.label} ${requirement.detail ?? ''}`,
  );
}

function applicationRequired(requirement: TargetRequirement): boolean {
  if (requirement.status === 'required') return true;
  // A field name such as "portfolio" or "transcript" says what the item is,
  // not that the programme requires it. Only explicit obligation language may
  // turn an application criterion into a deterministic hard gate.
  return /\b(required|mandatory|must\s+(?:submit|provide|include)|minimum|at\s+least|equivalent)\b/i.test(
    `${requirement.label} ${requirement.detail ?? ''}`,
  );
}

function mapRequirement(requirement: TargetRequirement): CriterionDraft {
  const sourceText = requirement.detail?.trim() || null;
  const category: CriterionCategory =
    requirement.category === 'academic'
      ? 'academic_requirement'
      : requirement.category === 'competency'
        ? 'competency'
        : requirement.category === 'selection' || requirement.category === 'application'
          ? 'selection_criterion'
          : 'scholarship';

  const hard =
    requirement.category === 'academic'
      ? requiredLanguage(requirement)
      : requirement.category === 'application'
        ? applicationRequired(requirement)
        : requirement.category === 'scholarship'
          ? requiredLanguage(requirement)
          : false;
  const requirementType: RequirementType =
    requirement.category === 'competency' || requirement.category === 'selection'
      ? 'soft'
      : hard
        ? 'hard'
        : 'unknown';
  const importance: CriterionImportance =
    hard ? 'critical' : requirement.status === 'required' ? 'high' : 'medium';
  const description = sourceText ?? requirement.label;

  return {
    identityLabel: requirement.label,
    sourceIdentity: requirement.id,
    category,
    label: requirement.label.trim(),
    description,
    importance,
    requirementType,
    sourceRefs: uniqueSorted(requirement.sourceRefs),
    sourceText,
    expectedSignals: tokens(`${requirement.label} ${description}`),
    negativeSignals: [],
    metadata: {
      importanceSource: hard || requirement.status === 'required' ? 'source' : 'default',
      targetRequirementId: requirement.id,
      missingInformation: requirement.missingInformation,
    },
  };
}

function mapFreeText(
  value: string,
  category: 'programme_value' | 'academic_preparation',
  requirementType: RequirementType,
  description?: string | null,
): CriterionDraft {
  const label = value.trim().replace(/\s+/g, ' ');
  return {
    identityLabel: label,
    sourceIdentity: null,
    category,
    label,
    description: description?.trim() || label,
    importance: 'medium',
    requirementType,
    sourceRefs: [],
    // TargetProfile does not carry source refs for these arrays; retain the
    // source text instead of fabricating a source identifier.
    sourceText: label,
    expectedSignals: tokens(`${label} ${description ?? ''}`),
    negativeSignals: [],
    metadata: {
      importanceSource: 'default',
      targetRequirementId: null,
      missingInformation: null,
    },
  };
}

function mergeDrafts(drafts: CriterionDraft[]): MatchingCriterion[] {
  const groups = new Map<string, CriterionDraft[]>();
  for (const draft of drafts) {
    const key = `${draft.category}\u0000${normalizeCriterionText(draft.identityLabel)}`;
    const group = groups.get(key) ?? [];
    group.push(draft);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group) => {
      const ordered = [...group].sort(
        (left, right) =>
          compareLexical(left.sourceIdentity ?? '', right.sourceIdentity ?? '') ||
          compareLexical(left.label, right.label),
      );
      const first = ordered[0];
      if (!first) throw new Error('Cannot normalize an empty criterion group.');
      const sourceIdentity = ordered.map((item) => item.sourceIdentity).filter((id): id is string => Boolean(id))[0] ?? null;
      const description = ordered.map((item) => item.description).find(Boolean) ?? first.label;
      // Preserve the first source text for unsourced free-text criteria. It is
      // the actual catalogue/profile wording; normalization is only for
      // identity and matching signals, not display provenance.
      const sourceText =
        first.sourceIdentity === null
          ? group.map((item) => item.sourceText).find(Boolean) ?? null
          : ordered.map((item) => item.sourceText).find(Boolean) ?? null;
      const targetRequirementId = ordered
        .map((item) => item.metadata.targetRequirementId)
        .find((id): id is string => Boolean(id)) ?? null;
      const missingInformation = ordered
        .map((item) => item.metadata.missingInformation)
        .find((note): note is string => note !== null) ?? null;
      return {
        id: `${first.category}:${stableCriterionSlug(sourceIdentity ?? first.label)}`,
        category: first.category,
        label: first.label,
        description,
        importance: ordered.some((item) => item.importance === 'critical')
          ? 'critical'
          : first.importance,
        requirementType: ordered.some((item) => item.requirementType === 'hard')
          ? 'hard'
          : first.requirementType,
        sourceRefs: uniqueSorted(ordered.flatMap((item) => item.sourceRefs)),
        sourceText,
        expectedSignals: uniqueSorted(ordered.flatMap((item) => item.expectedSignals)),
        negativeSignals: uniqueSorted(ordered.flatMap((item) => item.negativeSignals)),
        metadata: {
          importanceSource: ordered.some((item) => item.metadata.importanceSource === 'source')
            ? 'source'
            : 'default',
          targetRequirementId,
          missingInformation,
        },
      } satisfies MatchingCriterion;
    })
    .sort(
      (left, right) =>
        CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category) ||
        compareLexical(normalizeCriterionText(left.label), normalizeCriterionText(right.label)) ||
        compareLexical(left.id, right.id),
    );
}

/** Convert all existing TargetProfile fields into stable, provenance-aware criteria. */
export function normalizeTargetProfile(targetProfile: TargetProfile): MatchingCriterion[] {
  const drafts: CriterionDraft[] = targetProfile.requirements.map(mapRequirement);
  drafts.push(
    ...targetProfile.universityValues.map((value) => mapFreeText(value, 'programme_value', 'preference')),
    ...targetProfile.programmeThemes.themes.map((theme) =>
      mapFreeText(theme, 'academic_preparation', 'soft', targetProfile.programmeThemes.description),
    ),
  );
  return mergeDrafts(drafts);
}
