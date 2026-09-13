/**
 * Course Parse Lifecycle Phases & Status Mappings
 *
 * Provides granular lifecycle phases:
 *   queued -> fetching -> extracting -> validating -> ready (or timeout / failed)
 *
 * Maintains 100% backward compatibility with legacy status strings:
 *   pending / processing / complete / timeout / failed
 */

import type { ParseJobStatus } from './job-queue';

export type CourseParsePhase =
  | 'queued'
  | 'fetching'
  | 'extracting'
  | 'validating'
  | 'ready'
  | 'timeout'
  | 'failed';

export type ErrorClassification = 'retryable' | 'terminal';

/**
 * Determine if an extraction/parse failure is retryable or terminal.
 */
export function classifyParseError(
  errorMessage: string | null | undefined,
  attempts = 0,
  maxAttempts = 3,
): ErrorClassification | null {
  if (!errorMessage) return null;
  if (attempts >= maxAttempts) return 'terminal';

  const lower = errorMessage.toLowerCase();

  // Known terminal conditions
  if (
    lower.includes('empty_page') ||
    lower.includes('not_configured') ||
    lower.includes('no text to read') ||
    lower.includes('invalid url') ||
    lower.includes('maximum attempts')
  ) {
    return 'terminal';
  }

  // Network, gateway, model timeouts are retryable
  return 'retryable';
}

/**
 * Maps granular phase to the legacy ParseJobStatus string used by PostgreSQL
 * and historical callers.
 */
export function mapPhaseToLegacyStatus(phase: CourseParsePhase): ParseJobStatus {
  switch (phase) {
    case 'queued':
      return 'pending';
    case 'fetching':
    case 'extracting':
    case 'validating':
      return 'processing';
    case 'ready':
      return 'complete';
    case 'timeout':
      return 'timeout';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Maps legacy status, progress percentage, and staleness into an externally
 * visible granular phase.
 */
export function mapStatusToPhase(options: {
  status: string | null | undefined;
  phase?: string | null | undefined;
  progressPercentage?: number | null | undefined;
  isStale?: boolean;
}): CourseParsePhase {
  const { status, phase, progressPercentage, isStale } = options;

  if (status === 'complete') return 'ready';
  if (status === 'failed') return 'failed';
  if (status === 'timeout' || isStale) return 'timeout';
  if (status === 'pending') return 'queued';

  // If explicit phase is stored and valid, use it
  if (
    phase === 'queued' ||
    phase === 'fetching' ||
    phase === 'extracting' ||
    phase === 'validating' ||
    phase === 'ready' ||
    phase === 'timeout' ||
    phase === 'failed'
  ) {
    return phase;
  }

  // If in processing, infer phase from progress percentage
  if (status === 'processing') {
    const progress = progressPercentage ?? 0;
    if (progress >= 80) return 'validating';
    if (progress >= 40) return 'extracting';
    return 'fetching';
  }

  return 'queued';
}
