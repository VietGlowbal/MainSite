import { ICONS, KitIcon } from '@/shared/ui';

/**
 * A pass/fail marker for the readiness checklist.
 *
 * The icon differs by shape as well as colour — a tick versus a message circle —
 * because the readiness list is the one place in this feature where nine rows are
 * distinguished only by their marker, and nine rows of identical glyphs in two
 * colours is unreadable to anyone who cannot separate the two. The visible label
 * beside it still carries the meaning; this is reinforcement, so it is
 * `aria-hidden`.
 */
export function CheckMark({ passed }: { passed: boolean }) {
  return (
    <span aria-hidden className={passed ? 'text-fg-verified' : 'text-fg-brand'}>
      <KitIcon art={passed ? ICONS.checkCircle : ICONS.messageChatCircle} frame={16} />
    </span>
  );
}
