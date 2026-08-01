import { statusLabel } from '../domain';
import type { WorkspaceStatus } from '../domain';

/**
 * A document's status, as text plus a shape.
 *
 * WHY THE ICON IS NOT OPTIONAL. The accessibility rule for this feature is that
 * status is never conveyed by colour alone, and the easy failure is a coloured
 * dot with a label whose colour carries the only distinction between "in
 * progress" and "needs attention". So each status gets its own glyph AND its own
 * word, and the colour is the third signal rather than the first. A screenshot in
 * greyscale still reads correctly, which is the test.
 *
 * The glyphs are inline SVG rather than KitIcon art because these four are
 * status semantics, not iconography — a check, a warning, a half-filled ring and
 * an empty ring — and pinning them beside the labels is what keeps the pairing
 * from being reassigned.
 */

const TONE: Record<WorkspaceStatus, string> = {
  not_started: 'border-line bg-surface-muted text-fg-tertiary',
  in_progress: 'border-line-strong bg-surface text-fg-secondary',
  needs_attention: 'border-line-error bg-surface-error text-fg-error',
  ready_for_audit: 'border-brand bg-brand-subtle text-fg-brand',
};

function StatusGlyph({ status }: { status: WorkspaceStatus }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 20 20',
    fill: 'none',
    'aria-hidden': true as const,
  };

  if (status === 'ready_for_audit') {
    return (
      <svg {...common}>
        <path
          d="M4 10.5 8 14.5 16 6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === 'needs_attention') {
    return (
      <svg {...common}>
        <path
          d="M10 3.5 18 16.5H2z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M10 8v3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="14" r="0.9" fill="currentColor" />
      </svg>
    );
  }

  if (status === 'in_progress') {
    // Half-filled ring: begun, not finished.
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle
        cx="10"
        cy="10"
        r="7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

export function StatusPill({
  status,
  className,
}: {
  status: WorkspaceStatus;
  className?: string | undefined;
}) {
  return (
    <span
      className={`inline-flex items-center gap-gb-xs rounded-gb-full border px-gb-lg py-gb-xxs text-gb-xs font-semibold ${TONE[status]} ${className ?? ''}`}
    >
      <StatusGlyph status={status} />
      {statusLabel(status)}
    </span>
  );
}

/**
 * The compact form for the sub-status rows inside a workspace card.
 *
 * Same glyph-plus-word pairing, no border — a card listing five bordered pills
 * reads as five separate things rather than one document's parts.
 */
export function StatusText({ status }: { status: WorkspaceStatus }) {
  const tone =
    status === 'needs_attention'
      ? 'text-fg-error'
      : status === 'ready_for_audit'
        ? 'text-fg-brand'
        : status === 'in_progress'
          ? 'text-fg-secondary'
          : 'text-fg-tertiary';

  return (
    <span className={`inline-flex items-center gap-gb-xs text-gb-sm font-medium ${tone}`}>
      <StatusGlyph status={status} />
      {statusLabel(status)}
    </span>
  );
}
