import { z } from 'zod';
import { TARGET_PROFILE_FIELDS, type CvTargetProfile, type DataOrigin, type TargetProfileField } from './types';

/**
 * The seven Target Profile fields: their labels, where each one's answer comes
 * from, and the example text shown before generation.
 *
 * WHY ORIGIN IS DECLARED PER FIELD RATHER THAN RETURNED BY THE MODEL. "Định vị
 * trường" is answered by the university's own material; "Định hướng nghề nghiệp"
 * is answered by the student. That is a property of the question, not of any
 * particular generation, so it is pinned here. Letting the model report it would
 * mean the badge changes between runs for the same field, and the badge is the
 * student's only signal for which values they are the authority on.
 *
 * English is the source locale. The workspace passes these strings through
 * `t()` so both locales use the same field definitions.
 */

export type TargetProfileFieldDef = {
  key: TargetProfileField;
  /** As drawn in the approved design. */
  label: string;
  /** One line under the label. Explains the question, not the AI. */
  hint: string;
  origin: DataOrigin;
  /** Quiet placeholder before generation. Never presented as saved content. */
  example: string;
  /** Longer answers get a taller box. */
  rows: number;
};

export const TARGET_PROFILE_FIELD_DEFS: readonly TargetProfileFieldDef[] = [
  {
    key: 'careerDirection',
    label: 'Career direction',
    hint: 'Where do you want to go after graduation.',
    origin: 'profile',
    example: 'Example: become a data engineer in healthcare in Southeast Asia.',
    rows: 3,
  },
  {
    key: 'universityPositioning',
    label: 'University positioning',
    hint: 'How does this university position itself?',
    origin: 'university',
    example: 'Example: a research-intensive university highly ranked for computer science.',
    rows: 3,
  },
  {
    key: 'educationPhilosophy',
    label: 'Education philosophy',
    hint: 'How the university teaches and what it values in students.',
    origin: 'university',
    example: 'Example: project-based learning with a strong theoretical foundation.',
    rows: 3,
  },
  {
    key: 'environment',
    label: 'Environment',
    hint: 'The learning environment you will enter.',
    origin: 'university',
    example: 'Example: small classes, an international community, and strong industry links.',
    rows: 3,
  },
  {
    key: 'programmeObjectives',
    label: 'Programme objectives',
    hint: 'What this programme promises its graduates will be able to do.',
    origin: 'university',
    example: 'Example: train engineers who can build large-scale data systems.',
    rows: 4,
  },
  {
    key: 'priorityCapabilities',
    label: 'Priority capabilities',
    hint: 'The capabilities your CV most needs to prove.',
    origin: 'mixed',
    example: 'Example: analytical thinking, programming, and interdisciplinary teamwork.',
    rows: 4,
  },
  {
    key: 'careerAlignment',
    label: 'Career Alignment',
    hint: 'Where your direction and this programme meet.',
    origin: 'mixed',
    example: 'Example: the programme focuses on health data, matching your career goal.',
    rows: 4,
  },
];

const BY_KEY = new Map(TARGET_PROFILE_FIELD_DEFS.map((d) => [d.key, d]));

export function targetProfileField(key: TargetProfileField): TargetProfileFieldDef {
  const def = BY_KEY.get(key);
  // The map is built from the same const array the type is derived from, so this
  // is unreachable; it exists so the return type is not `| undefined` at 14 call
  // sites.
  if (!def) throw new Error(`Unknown target profile field: ${key}`);
  return def;
}

export const ORIGIN_LABEL: Record<DataOrigin, string> = {
  university: 'From university',
  profile: 'From profile',
  mixed: 'Mixed',
};

/** How many of the seven have content. Drives the status derivation. */
export function filledFieldCount(
  tp: Pick<CvTargetProfile, TargetProfileField> | null | undefined,
): number {
  if (!tp) return 0;
  return TARGET_PROFILE_FIELDS.filter((key) => {
    const value = tp[key];
    return typeof value === 'string' && value.trim().length > 0;
  }).length;
}

export function isTargetProfileComplete(
  tp: Pick<CvTargetProfile, TargetProfileField> | null | undefined,
): boolean {
  return filledFieldCount(tp) === TARGET_PROFILE_FIELDS.length;
}

/**
 * Whether a patch actually changes anything.
 *
 * The route calls this before writing, because `upsertTargetProfile` bumps
 * `version` unconditionally and a version that moves when nothing changed would
 * invalidate a CV review the student just paid for. Blurring a field without
 * typing is the common case that would otherwise do it.
 */
export function isNoopPatch(
  current: Pick<CvTargetProfile, TargetProfileField> | null,
  patch: TargetProfilePatchInput,
): boolean {
  if (!current) return false;
  return TARGET_PROFILE_FIELDS.every((key) => {
    const incoming = patch[key];
    if (incoming === undefined) return true;
    return (incoming ?? '') === (current[key] ?? '');
  });
}

// ── HTTP validation ───────────────────────────────────────────────────────

const fieldValue = z.string().max(1200).nullable().optional();

export const targetProfilePatchSchema = z.object({
  careerDirection: fieldValue,
  universityPositioning: fieldValue,
  educationPhilosophy: fieldValue,
  environment: fieldValue,
  programmeObjectives: fieldValue,
  priorityCapabilities: fieldValue,
  careerAlignment: fieldValue,
});

export type TargetProfilePatchInput = z.infer<typeof targetProfilePatchSchema>;
