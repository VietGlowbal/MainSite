import { z } from 'zod';
import {
  achievementSchema,
  activitySchema,
  type AchievementValues,
  type ActivityValues,
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

function searchable(text: string) {
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

export function applyEvidenceCandidates(
  achievements: AchievementValues[],
  activities: ActivityValues[],
  candidates: EvidenceCandidate[],
): { achievements: AchievementValues[]; activities: ActivityValues[] } {
  const nextAchievements = achievements.filter(({ title }) => title.trim().length > 0);
  const nextActivities = activities.filter(({ title }) => title.trim().length > 0);
  const achievementTitles = new Set(nextAchievements.map(({ title }) => searchable(title)));
  const activityTitles = new Set(nextActivities.map(({ title }) => searchable(title)));

  for (const candidate of candidates) {
    if (candidate.kind === 'achievement') {
      if (achievementTitles.has(searchable(candidate.data.title))) continue;
      achievementTitles.add(searchable(candidate.data.title));
      nextAchievements.push({ ...candidate.data, id: `extracted-${candidate.candidateId}` });
    } else {
      if (activityTitles.has(searchable(candidate.data.title))) continue;
      activityTitles.add(searchable(candidate.data.title));
      nextActivities.push({ ...candidate.data, id: `extracted-${candidate.candidateId}` });
    }
  }

  return { achievements: nextAchievements, activities: nextActivities };
}
