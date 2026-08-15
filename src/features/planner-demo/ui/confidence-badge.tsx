import type { ConfidenceLevel } from '../domain';

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  high: 'bg-tier-safe text-on-tier-safe',
  medium: 'bg-info-subtle text-fg-info',
  low: 'bg-surface-muted text-fg-muted',
};

/**
 * Per CLAUDE.md's rule on AI-generated content: any AI-extracted fact needs a
 * visible confidence level, not a bare claim. Used on the report and match
 * task workspaces, the two GenUI types that display AI output rather than
 * static reference content.
 */
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-gb-full px-gb-lg py-gb-xxs text-gb-xs font-medium ${CONFIDENCE_CLASS[level]}`}
    >
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}
