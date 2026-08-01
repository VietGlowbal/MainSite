import {
  CV_SECTION_KINDS,
  SECTION_FIELDS,
  newEntryId,
  type CvEntry,
  type CvEntryField,
  type CvImportDraft,
  type CvSection,
  type CvSectionKind,
} from '@/features/application-strategy/domain';
import {
  asBoolean,
  asEnum,
  asNullableString,
  asObjectArray,
  asStringArray,
  callStrategyModel,
  type AiCallResult,
} from './call';
import { withTrustRules } from './prompts';

/**
 * Turn CV text into the structured section/entry shape.
 *
 * WHY THIS IS EXTRACTION AND NOT IMPROVEMENT. The model is doing one job here:
 * reading what the student already wrote and putting it in the right boxes. It is
 * explicitly forbidden from rewriting, tightening or "improving" a bullet, because
 * the student is about to confirm this as their own content and the confirmation
 * screen is not a place to review prose changes they did not ask for. Rewriting is
 * a separate, opt-in operation with its own accept/dismiss flow.
 *
 * WHY PER-FIELD CONFIDENCE. A CV that says "Hanoi, 2023" leaves genuine ambiguity
 * about whether Hanoi is a location or an organisation, and about whether 2023 is a
 * start or an end. The model reports which fields it guessed at; the confirmation
 * screen marks those `Please check`. Without it the student has to re-read
 * everything with equal suspicion, which in practice means they skim all of it.
 */

const SYSTEM_PROMPT = `You convert the raw text of a CV into structured data. You are a transcriber, not an editor.

ABSOLUTE RULE: reproduce the candidate's own wording. Do not rewrite, shorten, expand, correct grammar, translate, or "improve" any text. If a bullet is badly written, it stays badly written. The candidate will confirm this content as their own, and changing their words without asking is not acceptable.

Split the text into sections. Valid section kinds:
${CV_SECTION_KINDS.filter((k) => k !== 'custom').join(', ')}
Use "custom" with a "title" only for a section that genuinely does not fit any of the above.

For each section, produce entries. Each entry may have:
- organization: the employer, school, publisher or body
- role: the job title, degree, project name, award name or skill group
- location: city and/or country
- startDate, endDate: exactly as written in the CV ("Sep 2023", "2021", "09/2021"). Do not reformat or infer a missing part.
- current: true only if the CV says the candidate is still there ("present", "current", "now")
- bullets: the description lines, VERBATIM, one array item per line or sentence-group as the CV presents them
- evidence: a metric or proof the CV states explicitly, if any

FIELD RELEVANCE: only include fields that make sense for the section. A skills section has bullets and nothing else. A contact section uses "role" for the label ("Email", "Phone", "LinkedIn") and "organization" for the value.

CONFIDENCE: for each entry, list in "uncertainFields" the names of any fields you had to guess at — an ambiguous date, a location you inferred, a role you assembled from fragments. Be honest here; this list is shown to the candidate as "Please check". If you are confident about everything in an entry, use an empty array.

If the text contains no recognisable CV content at all, return an empty sections array and explain why in "notes".

Respond with JSON only:
{
  "sections": [
    {
      "kind": "education",
      "title": null,
      "entries": [
        {
          "organization": "",
          "role": "",
          "location": null,
          "startDate": null,
          "endDate": null,
          "current": false,
          "bullets": [""],
          "evidence": null,
          "uncertainFields": []
        }
      ]
    }
  ],
  "notes": []
}`;

export type CvImportResult =
  | { ok: true; draft: CvImportDraft; model: string }
  | { ok: false; reason: Extract<AiCallResult, { ok: false }>['reason'] };

export async function importCvText(text: string): Promise<CvImportResult> {
  const result = await callStrategyModel({
    system: withTrustRules(SYSTEM_PROMPT),
    user: `CV TEXT:\n\n${text.slice(0, 20000)}\n\nConvert this to structured sections. Reproduce the candidate's wording exactly. Respond with JSON only.`,
    // Zero: this is transcription, and any creativity here is a defect.
    temperature: 0,
    maxTokens: 6000,
  });

  if (!result.ok) return { ok: false, reason: result.reason };

  return { ok: true, model: result.model, draft: normaliseDraft(result.data) };
}

/**
 * Coerce the model's output into a draft.
 *
 * Every field is filtered against `SECTION_FIELDS`, so a model that puts a start
 * date on a skills entry has that field dropped rather than producing an editor
 * that renders a field it has no input for.
 */
export function normaliseDraft(raw: Record<string, unknown>): CvImportDraft {
  const sections: CvSection[] = [];
  const uncertain: Record<string, CvEntryField[]> = {};

  for (const rawSection of asObjectArray(raw.sections, 24)) {
    const kind = asEnum<CvSectionKind>(rawSection.kind, CV_SECTION_KINDS, 'custom');
    const allowed = SECTION_FIELDS[kind];

    const entries: CvEntry[] = [];
    for (const rawEntry of asObjectArray(rawSection.entries, 60)) {
      const entry: CvEntry = { id: newEntryId(), bullets: [], collapsed: true };

      if (allowed.includes('organization')) entry.organization = asNullableString(rawEntry.organization, 300);
      if (allowed.includes('role')) entry.role = asNullableString(rawEntry.role, 300);
      if (allowed.includes('location')) entry.location = asNullableString(rawEntry.location, 200);
      if (allowed.includes('startDate')) entry.startDate = asNullableString(rawEntry.startDate, 60);
      if (allowed.includes('endDate')) entry.endDate = asNullableString(rawEntry.endDate, 60);
      if (allowed.includes('current')) entry.current = asBoolean(rawEntry.current);
      if (allowed.includes('evidence')) entry.evidence = asNullableString(rawEntry.evidence, 1000);
      entry.bullets = allowed.includes('bullets') ? asStringArray(rawEntry.bullets, 30, 2000) : [];

      // An entry with nothing in it is noise the student would have to delete.
      const hasContent =
        [entry.organization, entry.role, entry.evidence].some((v) => v && v.trim().length > 0) ||
        entry.bullets.length > 0;
      if (!hasContent) continue;

      const flagged = asStringArray(rawEntry.uncertainFields, 9, 40).filter((field): field is CvEntryField =>
        (allowed as readonly string[]).includes(field),
      );
      if (flagged.length > 0) uncertain[entry.id] = flagged;

      entries.push(entry);
    }

    if (entries.length === 0) continue;

    const title = kind === 'custom' ? asNullableString(rawSection.title, 120) : null;
    sections.push({ id: newEntryId(), kind, title, entries });
  }

  return { sections, uncertain, notes: asStringArray(raw.notes, 6, 300) };
}

/**
 * Build CV sections from the student's Glowbal profile, with no model call.
 *
 * WHY DETERMINISTIC. Every fact here was typed by the student into their profile
 * already. Passing it through a model to rearrange it introduces the possibility
 * of it coming back subtly different — a reworded achievement title, a year moved —
 * for no benefit. This is a data transform, so it is written as one.
 */
export function sectionsFromProfile(args: {
  achievements: readonly Record<string, unknown>[];
  activities: readonly Record<string, unknown>[];
  academics: string | null;
}): CvSection[] {
  const sections: CvSection[] = [];

  sections.push({ id: newEntryId(), kind: 'contact', entries: [{ id: newEntryId(), bullets: [], collapsed: false }] });

  const education: CvEntry[] = [];
  if (args.academics?.trim()) {
    education.push({
      id: newEntryId(),
      bullets: args.academics
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 10),
      collapsed: true,
    });
  }
  sections.push({ id: newEntryId(), kind: 'education', entries: education });

  const activityEntries = args.activities.slice(0, 20).map((row) => ({
    id: newEntryId(),
    organization: str(row.organisation),
    role: str(row.title),
    startDate: str(row.period),
    bullets: [str(row.description) ?? ''].filter((b) => b.length > 0),
    collapsed: true,
  }));
  if (activityEntries.length > 0) {
    sections.push({ id: newEntryId(), kind: 'activities', entries: activityEntries });
  }

  const awardEntries = args.achievements.slice(0, 20).map((row) => ({
    id: newEntryId(),
    role: str(row.title),
    organization: str(row.competition) ?? str(row.organisation),
    startDate: row.year != null ? String(row.year) : null,
    bullets: [str(row.detail) ?? ''].filter((b) => b.length > 0),
    // The level the student recorded is confirmed evidence, not a claim we made.
    evidence: str(row.level),
    collapsed: true,
  }));
  if (awardEntries.length > 0) {
    sections.push({ id: newEntryId(), kind: 'awards', entries: awardEntries });
  }

  return sections;
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
