/**
 * Scholarship constants + runtime validation.
 *
 * Single source of truth for the funding-type tokens and the shape of a
 * scholarship record, shared by:
 *   - the future scholarships API route (src/app/api/scholarships/*)
 *   - any server code that reads/writes public.scholarships
 *
 * The cleaning script (scripts/clean-scholarships.mjs) keeps its own copy of
 * FUNDING_TYPES because it runs under plain Node (no TS). Keep the two in sync.
 *
 * DB schema: supabase-scholarships.sql. TS row types: src/lib/types.ts.
 */
import { z } from 'zod';
import { FUNDING_TYPES, SCHOLARSHIP_SCOPES } from './scholarship-constants';

export {
  FUNDING_TYPES,
  FUNDING_TYPE_LABELS,
  SCHOLARSHIP_SCOPES,
  SCHOLARSHIP_SCOPE_LABELS,
  SCHOLARSHIP_STATUSES,
} from './scholarship-constants';

/**
 * Validates a cleaned scholarship record (the persisted column shape, plus the
 * transport-only `applies_to_candidates` the loader resolves to university IDs).
 */
export const scholarshipSchema = z.object({
  source_key: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().nullable().optional(),
  scope: z.enum(SCHOLARSHIP_SCOPES),
  country: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  funding_type: z.array(z.enum(FUNDING_TYPES)).default([]),
  coverage: z.string().nullable().optional(),
  amount_min: z.number().nullable().optional(),
  amount_max: z.number().nullable().optional(),
  amount_currency: z.string().nullable().optional(),
  slots: z.number().int().nullable().optional(),
  slots_text: z.string().nullable().optional(),
  eligibility: z.string().nullable().optional(),
  applies_to_text: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
  insight: z.string().nullable().optional(),
  deadline_date: z.string().nullable().optional(),
  deadline_text: z.string().nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  source_lang: z.enum(['en', 'vi', 'mixed']).nullable().optional(),
  ranking_note: z.string().nullable().optional(),
  raw: z.record(z.string(), z.unknown()).default({}),
  applies_to_candidates: z.array(z.string()).default([]),
});

export type ScholarshipInput = z.infer<typeof scholarshipSchema>;
