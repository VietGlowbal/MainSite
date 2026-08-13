import { z } from 'zod';
import { reflectionSchema, type ReflectionValues } from './reflection';
import { reflectionBlockingIssues, type BlockingIssue } from './reflection-steps';

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
  blockingIssues: BlockingIssue[];
  achievementsNeedingReview: number;
  activitiesNeedingReview: number;
  /** No blocking question unanswered, and nothing still `needs_review`. */
  ready: boolean;
};

/**
 * Is this student ready to confirm?
 *
 * Used identically by the Review & Confirm page (to show the readiness
 * banner and disable the confirm panel) and the confirm API route (to reject
 * a request that arrives past a client that let something slip through) —
 * one rule, checked in both places rather than trusted from the client.
 */
export function candidateReadiness(reflection: ReflectionValues): CandidateReadiness {
  const blockingIssues = reflectionBlockingIssues(reflection);
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
    ready:
      blockingIssues.length === 0 &&
      achievementsNeedingReview === 0 &&
      activitiesNeedingReview === 0,
  };
}
