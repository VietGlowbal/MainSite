import { ICONS, KitIcon } from './icons';

/**
 * CheckItem — Untitled UI "Check item text" (Figma 104:7180 and siblings).
 *
 * A rose check-circle in a 28px box, 12px from text at Text lg/Regular. The
 * 28px box and the 28px line height are the same number, so `items-start` puts
 * the tick on the first line's centre without any nudging — which is why this
 * does not need the `mt-` fudge these lists usually collect.
 *
 * Renders an <li>: the design draws three of these in a row and they are a
 * list, whatever the Figma frame is called. Wrap in `CheckList`.
 */
export function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex w-full items-start gap-gb-lg">
      <span className="flex size-[28px] shrink-0 items-center justify-center text-brand">
        <KitIcon art={ICONS.checkCircle} frame={28} />
      </span>
      <span className="min-w-0 flex-1 text-gb-lg text-fg-tertiary">{children}</span>
    </li>
  );
}

/**
 * The "Check items" frame: 20px apart, indented 16px from the text column
 * above it (Figma 104:7179 `pl-[var(--spacing-xl)]`).
 */
export function CheckList({ children }: { children: React.ReactNode }) {
  return <ul className="flex w-full flex-col gap-gb-2xl pl-gb-xl">{children}</ul>;
}
