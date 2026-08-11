import { z } from 'zod';
import type { CvEntry, CvSection, CvSectionKind } from './types';

/**
 * The CV's structure: which sections exist, which fields each one actually uses,
 * and what may be reordered, renamed or removed.
 *
 * WHY PER-SECTION FIELD LISTS. A Skills entry has no start date and no
 * organisation; an Education entry has both. Rendering the full nine-field form
 * for every entry is what turns this editor into the wall of empty inputs the
 * design rules forbid, and it also teaches the student that Glowbal does not know
 * what a CV looks like. The mapping is data so the editor cannot get it wrong for
 * one section and right for the rest.
 */

// ── The four CV steps ─────────────────────────────────────────────────────

/**
 * Keys double as the route segment under /cv/, so the step indicator can link
 * without a second lookup table that could disagree with the router.
 */
export const CV_STEPS = [
  { key: 'target-profile', label: 'Target Profile' },
  { key: 'content', label: 'CV content' },
  { key: 'review', label: 'CV review' },
  { key: 'layout', label: 'Layout - PDF' },
] as const;

export type CvStepKey = (typeof CV_STEPS)[number]['key'];

// ── Section catalogue ─────────────────────────────────────────────────────

export const CV_SECTION_KINDS = [
  'contact',
  'education',
  'experience',
  'activities',
  'projects',
  'research',
  'awards',
  'skills',
  'certifications',
  'publications',
  'interests',
  'custom',
] as const;

export const SECTION_LABEL: Record<CvSectionKind, string> = {
  contact: 'Contact information',
  education: 'Education',
  experience: 'Work experience',
  activities: 'Activities and leadership',
  projects: 'Projects',
  research: 'Research',
  awards: 'Awards',
  skills: 'Skills',
  certifications: 'Certifications',
  publications: 'Publications',
  interests: 'Interests',
  custom: 'Custom section',
};

export type CvEntryField =
  | 'organization'
  | 'role'
  | 'location'
  | 'startDate'
  | 'endDate'
  | 'current'
  | 'bullets'
  | 'evidence'
  | 'linkedProfileItem';

/**
 * Which fields an entry of each kind shows. Order is render order.
 *
 * `contact` is the odd one: its "entries" are name, email, phone and links, which
 * are single values rather than dated roles. It uses `role` as the label and
 * `organization` as the value, so one entry editor serves it without a second
 * component.
 */
export const SECTION_FIELDS: Record<CvSectionKind, readonly CvEntryField[]> = {
  contact: ['role', 'organization'],
  education: ['organization', 'role', 'location', 'startDate', 'endDate', 'current', 'bullets', 'evidence'],
  experience: ['organization', 'role', 'location', 'startDate', 'endDate', 'current', 'bullets', 'evidence', 'linkedProfileItem'],
  activities: ['organization', 'role', 'startDate', 'endDate', 'current', 'bullets', 'evidence', 'linkedProfileItem'],
  projects: ['role', 'organization', 'startDate', 'endDate', 'bullets', 'evidence'],
  research: ['organization', 'role', 'startDate', 'endDate', 'bullets', 'evidence'],
  awards: ['role', 'organization', 'startDate', 'evidence', 'linkedProfileItem'],
  skills: ['bullets'],
  certifications: ['role', 'organization', 'startDate', 'endDate'],
  publications: ['role', 'organization', 'startDate', 'bullets'],
  interests: ['bullets'],
  custom: ['role', 'organization', 'startDate', 'endDate', 'bullets', 'evidence'],
};

/**
 * Sections the student may delete.
 *
 * Contact and education are not on the list: a CV without contact details cannot
 * be acted on by an admissions office, and every applicant has an education
 * history. Everything else is genuinely optional depending on the person.
 */
export const OPTIONAL_SECTIONS: readonly CvSectionKind[] = [
  'experience',
  'activities',
  'projects',
  'research',
  'awards',
  'skills',
  'certifications',
  'publications',
  'interests',
  'custom',
];

/** Only a custom section may be renamed; the rest carry catalogue labels. */
export const RENAMEABLE_SECTIONS: readonly CvSectionKind[] = ['custom'];

/** The sections a CV starts with when built from scratch. */
export const DEFAULT_SECTION_KINDS: readonly CvSectionKind[] = [
  'contact',
  'education',
  'experience',
  'activities',
  'skills',
];

export function isOptionalSection(kind: CvSectionKind): boolean {
  return OPTIONAL_SECTIONS.includes(kind);
}

export function isRenameableSection(kind: CvSectionKind): boolean {
  return RENAMEABLE_SECTIONS.includes(kind);
}

export function sectionTitle(section: Pick<CvSection, 'kind' | 'title'>): string {
  if (isRenameableSection(section.kind) && section.title) return section.title;
  return SECTION_LABEL[section.kind];
}

export function sectionFields(kind: CvSectionKind): readonly CvEntryField[] {
  return SECTION_FIELDS[kind];
}

export function sectionUsesField(kind: CvSectionKind, field: CvEntryField): boolean {
  return SECTION_FIELDS[kind].includes(field);
}

// ── Reordering ────────────────────────────────────────────────────────────

/**
 * Move one item, returning a new array.
 *
 * Out-of-range indices return the input unchanged rather than throwing: the
 * caller is a move-up button on the first row, and the correct response to
 * "move the first item up" is nothing at all, not an error boundary.
 */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  if (to < 0 || to >= next.length) return next;
  if (from === to) return next;
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
}

// ── Completeness ──────────────────────────────────────────────────────────

/**
 * What is missing that an admissions reader would notice.
 *
 * Returned as a list of sentences for a small warning, NOT as a blocker. The
 * student is explicitly allowed to continue with an incomplete CV — they may be
 * mid-way through and know exactly what is left — so this informs and never
 * gates.
 */
export function essentialGaps(sections: readonly CvSection[]): string[] {
  const gaps: string[] = [];
  const byKind = new Map(sections.map((s) => [s.kind, s]));

  // Presence of an entry is not presence of content. A new CV is seeded with one
  // blank contact entry so the student has something to type into, and counting
  // that as "has contact details" is how a CV exports with no email on it.
  const contact = byKind.get('contact');
  if (!contact || !contact.entries.some(hasAnyContent)) {
    gaps.push('No contact details yet.');
  }

  const education = byKind.get('education');
  if (!education || !education.entries.some(hasAnyContent)) {
    gaps.push('No education entries yet.');
  }

  const hasExperienceLike = (['experience', 'activities', 'projects', 'research'] as const).some(
    (kind) => byKind.get(kind)?.entries.some(hasAnyContent) ?? false,
  );
  if (!hasExperienceLike) {
    gaps.push('Nothing under experience, activities, projects or research yet.');
  }

  const entriesWithNoDetail = sections
    .filter((s) => s.kind !== 'contact')
    .flatMap((s) => s.entries)
    .filter((e) => e.bullets.filter((b) => b.trim().length > 0).length === 0);
  if (entriesWithNoDetail.length > 0) {
    gaps.push(
      `${entriesWithNoDetail.length} ${
        entriesWithNoDetail.length === 1 ? 'entry has' : 'entries have'
      } no description yet.`,
    );
  }

  return gaps;
}

/** Whether an entry has anything a reader would see. */
export function hasAnyContent(entry: CvEntry): boolean {
  const text = [entry.organization, entry.role, entry.location, entry.evidence, ...entry.bullets];
  return text.some((value) => typeof value === 'string' && value.trim().length > 0);
}

export function countEntries(sections: readonly CvSection[]): number {
  return sections.reduce((n, s) => n + s.entries.length, 0);
}

// ── Construction ──────────────────────────────────────────────────────────

/**
 * Ids are generated client-side so a new entry can be rendered and focused before
 * any round trip. `crypto.randomUUID` is available in both the browsers this
 * targets and in Node 18+, so there is no need for a uuid dependency.
 */
export function newEntryId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyEntry(): CvEntry {
  return { id: newEntryId(), bullets: [''], collapsed: false };
}

export function emptySection(kind: CvSectionKind, title?: string): CvSection {
  return {
    id: newEntryId(),
    kind,
    ...(title ? { title } : {}),
    entries: kind === 'contact' ? [emptyEntry()] : [],
  };
}

export function defaultSections(): CvSection[] {
  return DEFAULT_SECTION_KINDS.map((kind) => emptySection(kind));
}

// ── Import draft ──────────────────────────────────────────────────────────

/**
 * What an import produces before the student confirms it.
 *
 * WHY A DRAFT TYPE AT ALL, rather than just writing sections. The requirement is
 * that an import can never silently destroy content the student typed, and the
 * cheapest way to guarantee that is for the import endpoint to have no write path:
 * it returns this, the student confirms on screen, and the confirmation is a
 * separate PATCH. Cancelling therefore leaves existing content untouched by
 * construction rather than by remembering to.
 *
 * `uncertain` maps an entry id to the fields the extractor was not confident
 * about, which the confirmation screen marks `Please check`. Per field rather than
 * per entry because "we think this end date is right but we are unsure of the
 * location" is the common case, and flagging the whole entry would make the
 * student re-read all of it.
 */
export type CvImportDraft = {
  sections: CvSection[];
  uncertain: Record<string, CvEntryField[]>;
  /** Facts about the extraction itself, e.g. "no dates were found anywhere". */
  notes: string[];
};

export function uncertainFields(draft: CvImportDraft, entryId: string): CvEntryField[] {
  return draft.uncertain[entryId] ?? [];
}

export function countUncertain(draft: CvImportDraft): number {
  return Object.values(draft.uncertain).reduce((n, fields) => n + fields.length, 0);
}

// ── HTTP validation ───────────────────────────────────────────────────────

/**
 * zod guards the request body only. Model output is coerced by hand in
 * lib/ai/strategy — a model that returns a slightly wrong shape should degrade to
 * fewer fields, not 500 the route, and `safeParse` on a whole CV gives no useful
 * partial result.
 */
const cvEntrySchema = z.object({
  id: z.string().min(1).max(80),
  organization: z.string().max(300).nullish(),
  role: z.string().max(300).nullish(),
  location: z.string().max(200).nullish(),
  startDate: z.string().max(60).nullish(),
  endDate: z.string().max(60).nullish(),
  current: z.boolean().optional(),
  bullets: z.array(z.string().max(2000)).max(30),
  evidence: z.string().max(1000).nullish(),
  linkedProfileItemId: z.string().max(80).nullish(),
  collapsed: z.boolean().optional(),
});

const cvSectionSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(CV_SECTION_KINDS),
  title: z.string().max(120).nullish(),
  entries: z.array(cvEntrySchema).max(60),
});

export const structuredCvPatchSchema = z.object({
  sections: z.array(cvSectionSchema).max(24).optional(),
  selectedLayout: z.enum(['academic', 'technical', 'leadership']).nullish(),
  sourceDocumentId: z.string().uuid().nullish(),
});

export type StructuredCvPatch = z.infer<typeof structuredCvPatchSchema>;
