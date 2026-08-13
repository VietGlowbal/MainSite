/**
 * Idempotent regeneration support.
 *
 * Storage requirement: "Make regeneration idempotent where inputs have not
 * changed." A caller (an API route) computes a hash of whatever raw input it
 * fed the extraction/scoring pipeline (the same `stableHash` pattern already
 * used for the Personal Report and match-insights caching — see
 * `src/features/apply/api/candidate-context.ts`), and calls
 * `shouldRegenerate` with that hash and this engine's version against
 * whatever was last stored. A `false` result means the stored
 * `ProfileEvaluation` is still correct for the current input and formulas,
 * and no model call or re-scoring needs to happen.
 *
 * `ENGINE_VERSION` is bumped whenever a scoring formula, weight, or
 * deterministic classification rule in `src/shared/evaluation` changes —
 * independently of any AI prompt version, which already exists on the
 * report tables and versions the MODEL CALL text, not this module's pure
 * logic. See `supabase-shared-evaluation-engine.sql` for why the two are
 * stored as separate columns.
 */

/** Bump on any change to a scoring formula, weight, or classification rule in this directory. */
export const ENGINE_VERSION = '1.0.0';

export type StoredEvaluationStamp = {
  inputHash: string;
  engineVersion: string;
};

/**
 * Whether a fresh evaluation run is needed. `true` when either the input has
 * changed since the stored evaluation was produced, or the stored evaluation
 * was produced by an older version of this engine's scoring logic — the same
 * output run through updated formulas is a different, and more correct,
 * result.
 */
export function shouldRegenerate(
  current: { inputHash: string },
  stored: StoredEvaluationStamp | null,
): boolean {
  if (!stored) return true;
  if (stored.inputHash !== current.inputHash) return true;
  if (stored.engineVersion !== ENGINE_VERSION) return true;
  return false;
}
