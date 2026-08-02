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
 * WHY THE LABELS ARE VIETNAMESE AND NOT RUN THROUGH t(). The rest of
 * /ai-strategy hardcodes Vietnamese, the approved frame for this screen is drawn
 * in Vietnamese, and `careerAlignment` is drawn in English in that same frame.
 * Matching the frame exactly beats internal consistency here; a dictionary pass
 * can lift all of /ai-strategy at once later.
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
    label: 'Định hướng nghề nghiệp',
    hint: 'Bạn muốn đi tới đâu sau khi tốt nghiệp.',
    origin: 'profile',
    example: 'Ví dụ: trở thành kỹ sư dữ liệu trong lĩnh vực y tế tại Đông Nam Á.',
    rows: 3,
  },
  {
    key: 'universityPositioning',
    label: 'Định vị trường',
    hint: 'Trường này tự định vị mình như thế nào.',
    origin: 'university',
    example: 'Ví dụ: đại học nghiên cứu chuyên sâu, xếp hạng cao về khoa học máy tính.',
    rows: 3,
  },
  {
    key: 'educationPhilosophy',
    label: 'Triết lý giáo dục',
    hint: 'Cách trường dạy và điều họ coi trọng ở sinh viên.',
    origin: 'university',
    example: 'Ví dụ: học qua dự án, chú trọng nền tảng lý thuyết vững.',
    rows: 3,
  },
  {
    key: 'environment',
    label: 'Môi trường',
    hint: 'Môi trường học tập bạn sẽ bước vào.',
    origin: 'university',
    example: 'Ví dụ: lớp nhỏ, cộng đồng quốc tế, gắn với doanh nghiệp.',
    rows: 3,
  },
  {
    key: 'programmeObjectives',
    label: 'Mục tiêu chương trình',
    hint: 'Chương trình này cam kết đào tạo ra điều gì.',
    origin: 'university',
    example: 'Ví dụ: đào tạo kỹ sư có thể xây dựng hệ thống dữ liệu quy mô lớn.',
    rows: 4,
  },
  {
    key: 'priorityCapabilities',
    label: 'Năng lực ưu tiên',
    hint: 'Những năng lực CV của bạn cần chứng minh rõ nhất.',
    origin: 'mixed',
    example: 'Ví dụ: tư duy phân tích, lập trình, làm việc nhóm liên ngành.',
    rows: 4,
  },
  {
    key: 'careerAlignment',
    label: 'Career Alignment',
    hint: 'Điểm gặp nhau giữa định hướng của bạn và chương trình này.',
    origin: 'mixed',
    example: 'Ví dụ: chương trình có hướng dữ liệu y tế, khớp với mục tiêu của bạn.',
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
