/**
 * Idempotent regeneration support.
 *
 * `ENGINE_VERSION` versions deterministic scoring/classification rules. AI
 * extraction/prompt versions are stored separately because they can change
 * without a formula change.
 */

/** Bump on any change to a scoring formula, weight, or classification rule in this directory. */
export const ENGINE_VERSION = '1.1.0';

export type StoredEvaluationStamp = {
  inputHash: string;
  engineVersion: string;
};

export function shouldRegenerate(
  current: { inputHash: string },
  stored: StoredEvaluationStamp | null,
): boolean {
  if (!stored) return true;
  if (stored.inputHash !== current.inputHash) return true;
  if (stored.engineVersion !== ENGINE_VERSION) return true;
  return false;
}
