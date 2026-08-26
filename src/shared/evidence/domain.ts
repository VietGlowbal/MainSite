/**
 * Canonical Evidence Bank schemas (Task 7).
 *
 * TWO HARD SEPARATIONS:
 * 1. RAW vs INTERPRETED — `RawSource` rows are what the student actually
 *    entered/uploaded; `AIInterpretation` rows are model output ABOUT those
 *    sources. They live in different collections and an interpretation id can
 *    never appear in a claim's `sourceRefs`.
 * 2. VERIFIED vs CLAIMED — only deterministic source rules (a document-backed
 *    or test-backed raw source with a comparable value) may mark a claim
 *    `verified`. AI interpretations can never promote anything to verified.
 *
 * Supplements (report-only answers) carry scope `report_only`: they feed the
 * report's prose but are structurally barred from verification.
 */

export type EvidenceSourceType =
  | 'achievement'
  | 'activity'
  | 'document'
  | 'english_test'
  | 'standardized_test'
  | 'profile_field'
  | 'follow_up_answer'
  | 'supplement';

export type VerificationStatus = 'unverified' | 'verified' | 'conflicting' | 'report_only';

export interface RawSource {
  id: string;
  type: EvidenceSourceType;
  label: string;
  capturedAt?: string;
}

/** Model output ABOUT raw sources — never verifiable, never a source itself. */
export interface AIInterpretation {
  id: string;
  origin: 'ai_extraction';
  module: string;
  payload: unknown;
  /** RawSource ids the interpretation was derived from. */
  sourceRefs: string[];
}

export type ClaimCategory = 'competency' | 'academic' | 'experience' | 'identity' | 'direction';

export interface NormalizedValue {
  metric: string;
  value: number;
  scale?: number | null;
}

export interface EvidenceClaim {
  id: string;
  category: ClaimCategory;
  statement: string;
  normalizedValue?: NormalizedValue | null;
  status: VerificationStatus;
  /** RawSource ids ONLY — interpretation ids are structurally excluded. */
  sourceRefs: string[];
  /** Interpretation ids that support this claim's phrasing (never sources). */
  interpretationRefs: string[];
  tags: {
    competencies: string[];
    criteria: string[];
  };
  limitations?: string[];
}

export interface EvidenceBank {
  version: string;
  sources: Record<string, RawSource>;
  interpretations: AIInterpretation[];
  claims: EvidenceClaim[];
  missingInformation: Array<{ area: string; note: string }>;
}

export const EVIDENCE_BANK_VERSION = 'eb-v1';
