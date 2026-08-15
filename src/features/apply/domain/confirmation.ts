import { z } from 'zod';
import { reflectionSchema, type ReflectionValues } from './reflection';
import type { BlockingIssue } from './reflection-steps';

/**
 * Review & Confirm — the checkpoint between finishing Candidate Information
 * and generating reports.
 *
 * ─── ONE JSONB BLOB, NOT A NORMALISED SNAPSHOT SCHEMA ────────────────────────
 *
 * The confirmed snapshot is `{ reflection: ReflectionValues, documents }` —
 * the exact shape the reflection pages already read and write, plus the
 * document list. A fully normalised per-section snapshot (a table per
 * personal/academic/study/aspirations/financial/achievement/activity slice)
 * would mean six-plus new tables and six-plus new readers for data that is
 * read and written as one object everywhere else in this feature. The
 * snapshot's whole job is "freeze exactly this", and a JSONB column of the
 * same shape the form already validates against does that with no new
 * surface to keep in sync.
 */

export const candidateSnapshotDocumentSchema = z.object({
  id: z.string().min(1),
  fileName: z.string().min(1),
});

export const candidateSnapshotPayloadSchema = z.object({
  reflection: reflectionSchema,
  documents: z.array(candidateSnapshotDocumentSchema).max(50).default([]),
});

export type CandidateSnapshotDocument = z.infer<typeof candidateSnapshotDocumentSchema>;
export type CandidateSnapshotPayload = z.infer<typeof candidateSnapshotPayloadSchema>;

export type CandidateReadiness = {
  /**
   * Kept in the response shape for backwards compatibility with the existing
   * Review & Confirm UI/API contract. The redesigned application flow no
   * longer has required questions in the old twelve-question "about" wizard,
   * so legacy questionnaire validation must not populate this list.
   */
  blockingIssues: BlockingIssue[];
  achievementsNeedingReview: number;
  activitiesNeedingReview: number;
  /** Nothing extracted by AI is still waiting for the student to review it. */
  ready: boolean;
};

/**
 * Is this student ready to confirm?
 *
 * The application setup redesign replaced the old twelve-question reflection
 * questionnaire with a read-only review of canonical onboarding/profile data.
 * That profile review deliberately allows fields to be absent: the student is
 * confirming that what GlowBal currently knows is accurate, not completing a
 * second copy of onboarding.
 *
 * `reflectionBlockingIssues()` still exists for the retired questionnaire's
 * own backwards-compatible form, but it MUST NOT gate this checkpoint. Doing
 * so made Review & Confirm require `majors`, `countries`, `intendedLevel` and
 * `intake` even though the new application flow no longer asks those questions
 * here — leaving students permanently unable to confirm or generate reports.
 *
 * The only data-level blocker that belongs at this checkpoint is unresolved AI
 * extraction: an achievement/activity marked `needs_review` must be accepted,
 * edited or removed before it can be frozen into the confirmed snapshot.
 */
export function candidateReadiness(reflection: ReflectionValues): CandidateReadiness {
  const blockingIssues: BlockingIssue[] = [];
  const achievementsNeedingReview = reflection.achievements.filter(
    (item) => item.reviewStatus === 'needs_review',
  ).length;
  const activitiesNeedingReview = reflection.activities.filter(
    (item) => item.reviewStatus === 'needs_review',
  ).length;

  return {
    blockingIssues,
    achievementsNeedingReview,
    activitiesNeedingReview,
    ready: achievementsNeedingReview === 0 && activitiesNeedingReview === 0,
  };
}
