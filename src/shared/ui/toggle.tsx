/**
 * Toggle — the kit's `Toggle` (Untitled UI), md size: a 44 × 24 track with a
 * 20px knob inset 2px.
 *
 * ⚠️ NOT DRAWN IN THE GLOWBAL FIGMA FILE. No frame uses a toggle yet; the
 * geometry is the kit's md toggle and the colours are the nearest existing
 * tokens. Added for the privacy-settings dialog, where a category is on or off
 * rather than one pick from a list — a checkbox there read as "agree to terms".
 *
 * The off track is `line-strong`, not the kit's bg-tertiary: the dialog sets
 * these on white cards, and a near-white track on white made "off" look like
 * "missing".
 *
 * Under the drawing is a real `<input type="checkbox" role="switch">`, laid
 * over the track at zero opacity rather than hidden, so it keeps its own click
 * target, focus and form behaviour, and a screen reader announces "switch, off"
 * instead of "checkbox, not checked". The track and knob follow its state
 * through `peer-*`.
 *
 * The caller names it (`aria-labelledby` or `aria-label`) — the label almost
 * always sits elsewhere in the row, so baking one in would force a layout.
 *
 * Width is not a spacing token: 44 = knob (2xl, 20) × 2 + inset (xxs, 2) × 2,
 * so it is written as that sum rather than as a literal.
 */

type Props = Omit<React.ComponentProps<'input'>, 'className' | 'type' | 'role'> & {
  className?: string | undefined;
};

export function Toggle({ className, ...rest }: Props) {
  return (
    <span className={className ? `relative inline-flex shrink-0 ${className}` : 'relative inline-flex shrink-0'}>
      <input
        {...rest}
        type="checkbox"
        role="switch"
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      />
      <span
        aria-hidden="true"
        className="flex h-gb-3xl w-[calc(var(--spacing-gb-2xl)*2+var(--spacing-gb-xxs)*2)] items-center rounded-gb-full bg-line-strong p-gb-xxs transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:opacity-60 peer-checked:[&>span]:translate-x-gb-2xl motion-reduce:transition-none"
      >
        <span className="size-gb-2xl rounded-gb-full bg-surface shadow-gb-xs transition-transform motion-reduce:transition-none" />
      </span>
    </span>
  );
}
