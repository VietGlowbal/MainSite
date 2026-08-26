/**
 * The common contract every AI analysis module in the application Personal
 * Report pipeline implements (see
 * docs/plans/2026-08-26-application-personal-report-backend.md Task 2).
 *
 * PERSISTENCE STAYS OUT OF MODULES. A module validates, builds context, and
 * generates; the orchestrator inserts a composite analysis only after every
 * required module's output has validated — so a module can never leave a
 * partial row behind.
 *
 * Modules are provider-neutral: `generate` may use `generateStructured` from
 * `./structured-generation` today without coupling the interface to OpenAI.
 */

export interface ValidationResult {
  ok: boolean;
  /** Machine-readable issue summaries safe to show to a repair prompt or log. */
  issues?: string[];
}

/** Everything a module needs to build its provider call for one input. */
export interface AIContext {
  moduleId: string;
  promptVersion: string;
  /**
   * Fully built provider payload. Contains candidate evidence — NEVER log it,
   * never persist it verbatim; only derived, validated outputs are persisted.
   */
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  metadata: Record<string, unknown>;
}

/**
 * Application-scoped working state shared across modules of one composite
 * analysis. Reconstructed from ONE confirmed snapshot (never live profile
 * tables); Tasks 4–7 flesh out the member domains.
 */
export interface ApplicantAIState {
  applicantId: string;
  applicationId: string;
  snapshotId: string;
  analysisVersionId?: string;
  targetProfile?: unknown;
  academicProfile?: unknown;
  activities: unknown[];
  evidenceBank: unknown[];
  identitySignals?: unknown;
  directionSignals?: unknown;
  personalReport?: unknown;
  metadata: StateMetadata;
}

export interface StateMetadata {
  createdAt: string;
  sourceFingerprints?: Record<string, string>;
  [key: string]: unknown;
}

export interface AIModule<I, O> {
  id: string;
  /** Versions the module's OUTPUT shape; bump on any breaking output change. */
  schemaVersion: string;
  /** Versions the module's PROMPT; bump when instructions change materially. */
  promptVersion: string;
  /** Cheap deterministic gate before any provider call is made. */
  validateInput(input: I): ValidationResult;
  buildContext(input: I, state: ApplicantAIState): Promise<AIContext>;
  generate(input: I, context: AIContext): Promise<O>;
  /** Post-generation validation (grounding, schema, cross-field rules). */
  validateOutput(output: O, context: AIContext): Promise<ValidationResult>;
}
