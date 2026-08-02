import { countEntries } from './cv-sections';
import type { CvLayoutKey, CvSectionKind, CvTargetProfile, StructuredCv } from './types';

/**
 * The three CV layouts, defined as data.
 *
 * WHY DATA RATHER THAN THREE TEMPLATES. The requirement is that these are
 * "genuinely different layouts, not only different labels", and three hand-written
 * templates converge: whoever writes the second one copies the first, and the
 * difference ends up being the heading order in one place and nothing else.
 * Expressing a layout as an explicit section order plus an emphasis set plus a
 * column count makes the difference machine-checkable — a test asserts the three
 * orders are pairwise distinct, so a label-only implementation fails the suite.
 *
 * WHAT `emphasise` MEANS AT RENDER TIME. An emphasised section prints every bullet
 * and its evidence line; a de-emphasised one prints the heading, the role and the
 * organisation, and drops to a single summary line. That is what makes an academic
 * CV and a technical CV of the same content read differently rather than just
 * being ordered differently.
 */

export type CvLayoutDef = {
  key: CvLayoutKey;
  label: string;
  /** One line on the selection card. */
  blurb: string;
  /** Full render order. Sections absent from the CV are skipped. */
  order: readonly CvSectionKind[];
  /** Rendered with full bullets and evidence. */
  emphasise: readonly CvSectionKind[];
  /**
   * Two columns puts skills/awards/certifications in a narrow sidebar. Academic
   * CVs are conventionally single-column and long; technical CVs are scanned.
   */
  columns: 1 | 2;
};

export const CV_LAYOUTS: readonly CvLayoutDef[] = [
  {
    key: 'academic',
    label: 'Academic',
    blurb: 'Leads with education, research and publications. Single column, full detail.',
    order: [
      'contact',
      'education',
      'research',
      'publications',
      'projects',
      'awards',
      'experience',
      'certifications',
      'skills',
      'activities',
      'interests',
      'custom',
    ],
    emphasise: ['education', 'research', 'publications', 'projects', 'awards'],
    columns: 1,
  },
  {
    key: 'technical',
    label: 'Technical',
    blurb: 'Leads with skills and technical projects. Two columns, scannable.',
    order: [
      'contact',
      'skills',
      'projects',
      'experience',
      'education',
      'certifications',
      'research',
      'awards',
      'publications',
      'activities',
      'interests',
      'custom',
    ],
    emphasise: ['skills', 'projects', 'experience'],
    columns: 2,
  },
  {
    key: 'leadership',
    label: 'Leadership',
    blurb: 'Leads with roles, organisations and community impact. Two columns.',
    order: [
      'contact',
      'activities',
      'experience',
      'awards',
      'education',
      'projects',
      'skills',
      'certifications',
      'research',
      'publications',
      'interests',
      'custom',
    ],
    emphasise: ['activities', 'experience', 'awards'],
    columns: 2,
  },
];

const BY_KEY = new Map(CV_LAYOUTS.map((l) => [l.key, l]));

export function cvLayout(key: CvLayoutKey): CvLayoutDef {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown CV layout: ${key}`);
  return def;
}

/**
 * Order the student's sections the way a layout wants them.
 *
 * Sections the layout does not mention are appended in their existing order
 * rather than dropped — a custom section the student added should still print.
 */
export function applyLayoutOrder<T extends { kind: CvSectionKind }>(
  sections: readonly T[],
  key: CvLayoutKey,
): T[] {
  const { order } = cvLayout(key);
  const rank = new Map(order.map((kind, i) => [kind, i]));
  return [...sections].sort((a, b) => {
    const ra = rank.get(a.kind) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.kind) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}

export function isEmphasised(key: CvLayoutKey, kind: CvSectionKind): boolean {
  return cvLayout(key).emphasise.includes(kind);
}

// ── Recommendation ────────────────────────────────────────────────────────

/**
 * Signals in the target profile that point at each layout.
 *
 * Matched against `priorityCapabilities` and `careerDirection`, which are the two
 * fields that actually describe what the CV must prove. Lowercased substring
 * matching, deliberately: the target profile is free text a student may have
 * edited, and anything cleverer would be unpredictable to explain in the one
 * sentence the UI has to justify the choice.
 */
const LAYOUT_SIGNALS: Record<CvLayoutKey, readonly string[]> = {
  academic: [
    'research',
    'nghiên cứu',
    'academic',
    'học thuật',
    'publication',
    'thesis',
    'luận văn',
    'phd',
    'master',
    'thạc sĩ',
    'theory',
    'lý thuyết',
    'lab',
  ],
  technical: [
    'technical',
    'kỹ thuật',
    'engineering',
    'software',
    'lập trình',
    'programming',
    'data',
    'dữ liệu',
    'analytical',
    'phân tích',
    'coding',
    'developer',
    'computer',
    'máy tính',
  ],
  leadership: [
    'leadership',
    'lãnh đạo',
    'community',
    'cộng đồng',
    'volunteer',
    'tình nguyện',
    'management',
    'quản lý',
    'team',
    'nhóm',
    'organis',
    'organiz',
    'tổ chức',
    'social',
    'xã hội',
  ],
};

/** Which sections' evidence supports each layout. */
const LAYOUT_EVIDENCE: Record<CvLayoutKey, readonly CvSectionKind[]> = {
  academic: ['research', 'publications', 'education', 'awards'],
  technical: ['projects', 'skills', 'experience'],
  leadership: ['activities', 'experience', 'awards'],
};

export type LayoutRecommendation = { key: CvLayoutKey; reason: string };

/**
 * Which layout to recommend, and the one sentence explaining why.
 *
 * Deterministic and derived from real strategy information rather than asked of a
 * model: the student is being told why their CV should be arranged a particular
 * way, and an explanation that changes between page loads is not an explanation.
 * The reason names the target profile field and the CV sections that drove it, so
 * it is checkable by the student against what they can see.
 *
 * Scoring: each signal hit in `priorityCapabilities` or `careerDirection` is worth
 * 2, each section with entries is worth 1 per entry up to 3. Capabilities outrank
 * evidence because the target profile is what the CV must prove; the evidence only
 * decides which arrangement proves it best. Ties break `technical` → `leadership` →
 * `academic`, the order of how common they are among Glowbal applicants.
 */
export function recommendLayout(
  targetProfile: Pick<CvTargetProfile, 'priorityCapabilities' | 'careerDirection'> | null,
  cv: Pick<StructuredCv, 'sections'> | null,
): LayoutRecommendation {
  const haystack = [targetProfile?.priorityCapabilities, targetProfile?.careerDirection]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase();

  const sectionEntries = new Map<CvSectionKind, number>();
  for (const section of cv?.sections ?? []) {
    sectionEntries.set(section.kind, (sectionEntries.get(section.kind) ?? 0) + section.entries.length);
  }

  const scored = (['technical', 'leadership', 'academic'] as const).map((key) => {
    const matched = LAYOUT_SIGNALS[key].filter((signal) => haystack.includes(signal));
    const evidenceSections = LAYOUT_EVIDENCE[key].filter((kind) => (sectionEntries.get(kind) ?? 0) > 0);
    const evidenceScore = LAYOUT_EVIDENCE[key].reduce(
      (n, kind) => n + Math.min(sectionEntries.get(kind) ?? 0, 3),
      0,
    );
    return { key, score: matched.length * 2 + evidenceScore, matched, evidenceSections };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  // No target profile and no CV yet. Say so rather than inventing a rationale —
  // the student can still choose, and a fabricated reason would be the one piece
  // of copy on the page they could catch us on.
  if (!winner || winner.score === 0) {
    return {
      key: 'technical',
      reason:
        'We do not have enough of your target profile or CV content yet to recommend a layout, so this is a general-purpose default.',
    };
  }

  const layout = cvLayout(winner.key);
  const parts: string[] = [];

  if (winner.matched.length > 0) {
    parts.push(`your target profile prioritises ${formatList(winner.matched.slice(0, 2))}`);
  }
  if (winner.evidenceSections.length > 0) {
    parts.push(
      `your strongest evidence sits in ${formatList(winner.evidenceSections.slice(0, 2).map(sectionWord))}`,
    );
  }

  return {
    key: winner.key,
    reason: `${layout.label} is recommended because ${parts.join(', and ')}.`,
  };
}

function sectionWord(kind: CvSectionKind): string {
  const words: Partial<Record<CvSectionKind, string>> = {
    research: 'research',
    publications: 'publications',
    education: 'education',
    awards: 'awards',
    projects: 'projects',
    skills: 'skills',
    experience: 'work experience',
    activities: 'activities and leadership',
  };
  return words[kind] ?? kind;
}

function formatList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Whether there is enough content to be worth exporting at all. */
export function canExport(cv: Pick<StructuredCv, 'sections'> | null): boolean {
  if (!cv) return false;
  return countEntries(cv.sections) > 0;
}
