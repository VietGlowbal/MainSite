import { ORIGIN_LABEL } from '../domain';
import type { DataOrigin } from '../domain';

/**
 * "From university" / "From profile" / "Mixed" on a target profile card.
 *
 * WHY THIS IS ON EVERY CARD. Four of the seven fields are answered by the
 * university's own material and three by the student. Without the badge, a student
 * reads all seven as things Glowbal decided about them, and either accepts a
 * programme claim they should verify or overwrites one they should keep. The badge
 * tells them which values they are the authority on.
 *
 * Grey rather than toned: it is a provenance label, not a status, and colouring it
 * would compete with the actual status indicators on the same page.
 */
export function OriginBadge({ origin }: { origin: DataOrigin }) {
  return (
    <span className="inline-flex items-center rounded-gb-full bg-surface-muted px-gb-md py-gb-xxs text-gb-xs font-medium whitespace-nowrap text-fg-muted">
      {ORIGIN_LABEL[origin]}
    </span>
  );
}
