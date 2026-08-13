import { z } from 'zod';
import {
  achievementSchema,
  activitySchema,
  type AchievementValues,
  type ActivityValues,
  type EvidenceSource,
} from './reflection';

const sourceRefSchema = z.object({
  documentId: z.string().min(1).max(100),
  page: z.number().int().positive(),
  quote: z.string().trim().min(3).max(500),
});

const candidateBase = z.object({
  candidateId: z.string().min(1).max(100),
  confidence: z.enum(['high', 'medium', 'needs_confirmation']),
  sourceRefs: z.array(sourceRefSchema).min(1).max(6),
});

export const evidenceCandidateSchema = z.discriminatedUnion('kind', [
  candidateBase.extend({
    kind: z.literal('achievement'),
    data: achievementSchema.omit({ id: true, evidenceKey: true }),
  }),
  candidateBase.extend({
    kind: z.literal('activity'),
    data: activitySchema.omit({ id: true }),
  }),
]);

export type EvidenceCandidate = z.infer<typeof evidenceCandidateSchema>;
export type EvidenceSourcePage = { documentId: string; page: number; text: string };

const extractionDocumentMetricSchema = z.object({
  documentId: z.string().min(1),
  fileName: z.string().min(1),
  totalPages: z.number().int().nonnegative(),
  pagesReadable: z.number().int().nonnegative(),
  pagesNeedingOcr: z.array(z.number().int().positive()),
  charactersExtracted: z.number().int().nonnegative(),
  coverage: z.number().min(0).max(1),
});

export const evidenceExtractionResponseSchema = z.object({
  documents: z.array(extractionDocumentMetricSchema),
  candidates: z.array(evidenceCandidateSchema),
  rejectedCount: z.number().int().nonnegative(),
  ocrRequired: z.boolean(),
  partial: z.boolean(),
  ocrProvider: z.literal('not_configured'),
});

export type EvidenceExtractionResponse = z.infer<typeof evidenceExtractionResponseSchema>;

export function searchable(text: string) {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function candidateKey(candidate: EvidenceCandidate) {
  const suffix =
    candidate.kind === 'achievement'
      ? `${candidate.data.title}|${candidate.data.year ?? ''}`
      : `${candidate.data.title}|${candidate.data.period ?? ''}`;
  return `${candidate.kind}|${searchable(suffix)}`;
}

export function validateEvidenceExtraction(raw: unknown, pages: EvidenceSourcePage[]) {
  const source = new Map(
    pages.map((page) => [`${page.documentId}:${page.page}`, searchable(page.text)]),
  );
  const rawItems =
    raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  const candidates: EvidenceCandidate[] = [];
  const byKey = new Map<string, EvidenceCandidate>();
  let rejectedCount = 0;

  for (const item of rawItems) {
    const parsed = evidenceCandidateSchema.safeParse(item);
    if (!parsed.success) {
      rejectedCount += 1;
      continue;
    }
    const validSources = parsed.data.sourceRefs.every((ref) =>
      source.get(`${ref.documentId}:${ref.page}`)?.includes(searchable(ref.quote)),
    );
    if (!validSources) {
      rejectedCount += 1;
      continue;
    }

    const key = candidateKey(parsed.data);
    const existing = byKey.get(key);
    if (existing) {
      existing.sourceRefs = [
        ...existing.sourceRefs,
        ...parsed.data.sourceRefs.filter(
          (ref) =>
            !existing.sourceRefs.some(
              (current) =>
                current.documentId === ref.documentId &&
                current.page === ref.page &&
                current.quote === ref.quote,
            ),
        ),
      ].slice(0, 6);
      continue;
    }

    byKey.set(key, parsed.data);
    candidates.push(parsed.data);
  }

  return { candidates, rejectedCount };
}

/** A candidate whose title matches a record already on the profile. */
export type EvidenceDuplicate = {
  candidate: EvidenceCandidate;
  existingId: string;
  existingTitle: string;
};

/** `sourceRefs` (validated against page text) → the persisted `sources` shape. */
function sourcesFromCandidate(
  candidate: EvidenceCandidate,
  documentNames: Record<string, string>,
): EvidenceSource[] {
  const seen = new Set<string>();
  const sources: EvidenceSource[] = [];
  for (const ref of candidate.sourceRefs) {
    const key = `${ref.documentId}:${ref.page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      documentId: ref.documentId,
      fileName: documentNames[ref.documentId] ?? ref.documentId,
      page: ref.page,
      quote: ref.quote,
    });
  }
  return sources.slice(0, 6);
}

function fromCandidate<T extends AchievementValues | ActivityValues>(
  candidate: EvidenceCandidate,
  documentNames: Record<string, string>,
): T {
  return {
    ...candidate.data,
    id: `extracted-${candidate.candidateId}`,
    reviewStatus: 'needs_review',
    sourceType: 'document',
    sources: sourcesFromCandidate(candidate, documentNames),
  } as T;
}

/**
 * Apply extracted candidates onto the current achievements/activities.
 *
 * A candidate whose title already matches an existing record is NOT
 * auto-applied — it comes back in `duplicates` instead, for the caller to
 * offer "Merge" (see `mergeDuplicate`) or "Keep both" (call `fromCandidate`'s
 * public sibling, `evidenceCandidateToItem`, and push it directly). Silently
 * dropping it, the previous behaviour, is indistinguishable from the
 * extraction having missed it.
 *
 * `documentNames` maps a document id to its file name, so a card can say
 * "Extracted from James_Lapslie_CV.pdf" rather than a bare id — pass
 * `EvidenceExtractionResponse.documents` reduced to `{ [documentId]: fileName }`.
 */
export function applyEvidenceCandidates(
  achievements: AchievementValues[],
  activities: ActivityValues[],
  candidates: EvidenceCandidate[],
  documentNames: Record<string, string> = {},
): {
  achievements: AchievementValues[];
  activities: ActivityValues[];
  duplicates: EvidenceDuplicate[];
} {
  const nextAchievements = achievements.filter(({ title }) => title.trim().length > 0);
  const nextActivities = activities.filter(({ title }) => title.trim().length > 0);
  const achievementByTitle = new Map(
    nextAchievements.map((item) => [searchable(item.title), item] as const),
  );
  const activityByTitle = new Map(
    nextActivities.map((item) => [searchable(item.title), item] as const),
  );
  const duplicates: EvidenceDuplicate[] = [];

  for (const candidate of candidates) {
    const key = searchable(candidate.data.title);
    const byTitle = candidate.kind === 'achievement' ? achievementByTitle : activityByTitle;
    const existing = byTitle.get(key);

    if (existing) {
      duplicates.push({
        candidate,
        existingId: existing.id ?? key,
        existingTitle: existing.title,
      });
      continue;
    }

    if (candidate.kind === 'achievement') {
      const item = fromCandidate<AchievementValues>(candidate, documentNames);
      achievementByTitle.set(key, item);
      nextAchievements.push(item);
    } else {
      const item = fromCandidate<ActivityValues>(candidate, documentNames);
      activityByTitle.set(key, item);
      nextActivities.push(item);
    }
  }

  return { achievements: nextAchievements, activities: nextActivities, duplicates };
}

/** The "Keep both" action on a flagged duplicate: apply it regardless. */
export function evidenceCandidateToItem<T extends AchievementValues | ActivityValues>(
  candidate: EvidenceCandidate,
  documentNames: Record<string, string> = {},
): T {
  return fromCandidate<T>(candidate, documentNames);
}

/**
 * "Merge" for a flagged duplicate.
 *
 * The existing record keeps its id — so any edit already made to it before
 * the merge survives — and gains whichever fields it was missing from the new
 * extraction. Source lists union rather than replace, so "View source" can
 * point at either document afterwards; that is the whole point of flagging a
 * duplicate rather than silently keeping the first one seen.
 */
export function mergeDuplicate<T extends AchievementValues | ActivityValues>(
  existing: T,
  incoming: T,
): T {
  const merged: Record<string, unknown> = { ...existing };

  for (const [field, value] of Object.entries(incoming)) {
    if (field === 'id' || field === 'sources' || field === 'sourceType' || field === 'reviewStatus') {
      continue;
    }
    const current = merged[field];
    if ((current === undefined || current === '') && value !== undefined && value !== '') {
      merged[field] = value;
    }
  }

  const existingSources = existing.sources ?? [];
  const incomingSources = incoming.sources ?? [];
  const seenSources = new Set(existingSources.map((s) => `${s.documentId}:${s.page ?? ''}`));
  merged['sources'] = [
    ...existingSources,
    ...incomingSources.filter((s) => !seenSources.has(`${s.documentId}:${s.page ?? ''}`)),
  ].slice(0, 6);
  merged['sourceType'] = 'document';

  return merged as T;
}
