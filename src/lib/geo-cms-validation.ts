/**
 * Client-safe publication checks for GEO articles, shared by:
 *
 *   - the admin publish transition (`/api/admin/news/[id]` PATCH),
 *   - the public read path (`src/lib/geo-content.ts` — a row that fails the
 *     placeholder gate never renders or enters the sitemap), and
 *   - the generation pipeline's quality step (`scripts/geo/qualityCheck.ts`).
 *
 * ONE copy of every regex on purpose: the plan forbids the script and the API
 * drifting apart, which is how "A Glowbal draft guide …" reached production
 * marked `published`.
 */

export type PublishValidationInput = {
  title?: string | null;
  description?: string | null;
  body?: string | null;
  topic?: string | null;
  hero_image?: string | null;
  meta?: Record<string, unknown> | null;
};

export function validateArticleForPublish(input: PublishValidationInput): string[] {
  const errors: string[] = [];
  if (!input.title?.trim()) errors.push('Title is required');
  if (!input.description?.trim()) errors.push('Description is required');
  if (!input.body?.trim()) errors.push('Body is required');
  if (!input.topic?.trim() || input.topic.trim() === 'All topics') errors.push('Topic is required');
  if (!input.hero_image?.trim()) errors.push('Hero image is required');
  const alt = input.meta && typeof input.meta.heroImageAlt === 'string' ? input.meta.heroImageAlt : '';
  if (!alt.trim()) errors.push('Hero image alt text is required');
  if (/!\[\s*\]\(/.test(input.body ?? '') || /<img\b[^>]*\balt\s*=\s*["']\s*["']/i.test(input.body ?? '')) {
    errors.push('Every inline image needs alt text');
  }
  return errors;
}

// ── Publication-quality gate ─────────────────────────────────────────────────

export type PublicationBlockerCode =
  | 'MISSING_SLUG'
  | 'MISSING_TITLE'
  | 'MISSING_DESCRIPTION'
  | 'MISSING_BODY'
  | 'PLACEHOLDER_SOURCE_MARKER'
  | 'PLACEHOLDER_COPY'
  | 'UNVERIFIED_FACTUAL_CLAIMS'
  | 'HUMAN_REVIEW_REQUIRED';

export type PublicationBlocker = { code: PublicationBlockerCode; message: string };

export type PublicationQualityInput = {
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  excerpt?: string | null;
  body?: string | null;
  /** Number of verified official sources backing the article's claims. */
  officialSourceCount?: number;
  /** When true, an explicit human-review sign-off is required to publish. */
  requireHumanReview?: boolean;
  humanReviewApproved?: boolean;
};

/** The pipeline's leftover source placeholder token. */
const PLACEHOLDER_SOURCE_RE = /TODO_SOURCE_REQUIRED/;
/** Generator draft copy and other placeholder prose a reader must never see. */
const PLACEHOLDER_COPY_RE = /\b(?:draft guide|placeholder|lorem ipsum|coming soon)\b/i;

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Specific cost/entry numbers with no linked source line — ported from the
 * pipeline's quality step so the script and the API share one detector.
 */
export function hasUnverifiedTuitionClaims(body: string): boolean {
  return body.split('\n').some((line) => {
    const lower = line.toLowerCase();
    const mentionsCost = /\b(tuition|fee|fees|cost|costs)\b/.test(lower);
    const looksLikePrice = /(?:£|\$|€)\s?\d|\b\d{4,6}\b/.test(line);
    return mentionsCost && looksLikePrice && !/^[-*] .*https?:\/\//.test(line);
  });
}

export function hasUnverifiedEntryClaims(body: string): boolean {
  return body.split('\n').some((line) => {
    const lower = line.toLowerCase();
    const mentionsEntry = /\b(ielts|entry requirement|entry requirements|requirement|requirements)\b/.test(lower);
    const looksLikeScore = /\b[4-9](?:\.\d)?\b|\b\d{2,3}\s?(?:ucas|tariff)?\b/i.test(line);
    return mentionsEntry && looksLikeScore && !/^[-*] .*https?:\/\//.test(line);
  });
}

/**
 * Count verified official sources carried in the article's metadata.
 * Pipeline rows keep their sources in data files; DB rows may record them as
 * `meta.sources[{ sourceType }]` or a plain `meta.officialSourceCount`.
 */
export function countOfficialSources(meta?: Record<string, unknown> | null): number {
  if (!meta) return 0;
  const sources = meta.sources;
  if (Array.isArray(sources)) {
    return sources.filter(
      (source) =>
        !!source &&
        typeof source === 'object' &&
        typeof (source as { sourceType?: unknown }).sourceType === 'string' &&
        ['official-university', 'official-government', 'official-scholarship'].includes(
          (source as { sourceType: string }).sourceType,
        ),
    ).length;
  }
  const explicit = meta.officialSourceCount;
  return typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0 ? Math.floor(explicit) : 0;
}

/**
 * The hard publication-quality gate. Returns every blocker; publishing is
 * refused while any is present.
 */
export function listPublicationBlockers(input: PublicationQualityInput): PublicationBlocker[] {
  const blockers: PublicationBlocker[] = [];

  if (!hasText(input.slug)) blockers.push({ code: 'MISSING_SLUG', message: 'Slug is required' });
  if (!hasText(input.title)) blockers.push({ code: 'MISSING_TITLE', message: 'Title is required' });
  if (!hasText(input.description)) {
    blockers.push({ code: 'MISSING_DESCRIPTION', message: 'Description is required' });
  }
  if (!hasText(input.body)) blockers.push({ code: 'MISSING_BODY', message: 'Body is required' });

  const markerFields = [input.title, input.description, input.excerpt, input.body];
  if (markerFields.some((field) => hasText(field) && PLACEHOLDER_SOURCE_RE.test(field))) {
    blockers.push({
      code: 'PLACEHOLDER_SOURCE_MARKER',
      message: 'Body or description still contains TODO_SOURCE_REQUIRED markers — add verified official sources first',
    });
  }

  const copyFields = [input.title, input.description, input.excerpt];
  const placeholderField = copyFields.find(
    (field): field is string => hasText(field) && PLACEHOLDER_COPY_RE.test(field),
  );
  if (placeholderField !== undefined) {
    const matched = placeholderField.match(PLACEHOLDER_COPY_RE)?.[0] ?? 'placeholder copy';
    blockers.push({
      code: 'PLACEHOLDER_COPY',
      message: `Description or excerpt still contains generator placeholder copy ("${matched}") — write a real reader-facing summary`,
    });
  }

  const body = hasText(input.body) ? input.body : '';
  const makesFactualClaims = hasUnverifiedTuitionClaims(body) || hasUnverifiedEntryClaims(body);
  if (makesFactualClaims && !(input.officialSourceCount && input.officialSourceCount > 0)) {
    blockers.push({
      code: 'UNVERIFIED_FACTUAL_CLAIMS',
      message:
        'Content states tuition, fees, or entry requirements without a verified official source — add one before publishing',
    });
  }

  if (input.requireHumanReview && !input.humanReviewApproved) {
    blockers.push({
      code: 'HUMAN_REVIEW_REQUIRED',
      message: 'The configured human-review requirement has not been satisfied yet',
    });
  }

  return blockers;
}

/**
 * Public-read gate used by src/lib/geo-content.ts: a row that carries
 * placeholder quality must never render publicly, appear in the sitemap, or be
 * listed — regardless of its stored status. Only placeholder signals hide a row
 * here; checklist gaps are the admin editor's job, not a reason to silently
 * unpublish otherwise-fine content.
 *
 * `body` is optional because legacy file guides arrive pre-sanitised (the
 * sanitizer already strips TODO markers); DB rows pass the raw body so a
 * marker hidden by sanitisation still disqualifies the row.
 */
export function hasPlaceholderPublicationQuality(
  input: Pick<PublicationQualityInput, 'title' | 'description' | 'excerpt' | 'body'>,
): boolean {
  const fields = [input.title, input.description, input.excerpt];
  if (fields.some((field) => hasText(field) && PLACEHOLDER_SOURCE_RE.test(field))) return false;
  if (hasText(input.body) && PLACEHOLDER_SOURCE_RE.test(input.body)) return false;
  return !fields.some((field) => hasText(field) && PLACEHOLDER_COPY_RE.test(field));
}
