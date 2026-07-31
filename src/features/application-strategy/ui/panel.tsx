/**
 * The card treatment every Application Strategy screen uses.
 *
 * WHY A NEW COMPONENT RATHER THAN AN EXISTING CARD. There are two Cards in the
 * repo and neither is what the approved frames draw. `src/components/ui/card.tsx`
 * is the older generation; `src/shared/ui` has none at all. The frames show a
 * flat white block with a thin light border and no shadow, and the design rules
 * for this feature call out "flat, restrained cards" and "minimal or no shadow"
 * explicitly. Rather than pass the same six utility classes at fifteen call
 * sites — which is how the fifteenth ends up with a shadow — it is pinned here.
 *
 * `ReflectionSection`'s `bg-surface-muted` variant is deliberately NOT replaced
 * by this: that treatment is correct for the form groupings on the reflection and
 * target-profile pages, and those frames really do show a tinted block.
 */
export function Panel({
  children,
  className,
  as: Tag = 'section',
}: {
  children: React.ReactNode;
  className?: string | undefined;
  as?: 'section' | 'div' | 'article' | 'li';
}) {
  return (
    <Tag
      className={`flex flex-col gap-gb-2xl rounded-gb-2xl border border-line bg-surface p-gb-3xl ${className ?? ''}`}
    >
      {children}
    </Tag>
  );
}

/**
 * A panel's heading row: title on the left, one slot on the right.
 *
 * The right slot takes a status or a single control, never a second primary
 * action — one obvious primary action per view is a rule of this feature, and a
 * header with two buttons is the usual way it gets broken.
 */
export function PanelHeader({
  title,
  description,
  aside,
  headingLevel = 2,
}: {
  title: string;
  description?: string | undefined;
  aside?: React.ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <div className="flex flex-col gap-gb-xs">
      <div className="flex items-start justify-between gap-gb-xl">
        <Heading className="text-gb-lg font-semibold text-fg">{title}</Heading>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {description ? <p className="text-gb-sm text-fg-tertiary">{description}</p> : null}
    </div>
  );
}

/**
 * A label/value row for the sub-status lists on the workspace cards.
 *
 * Rows rather than a grid because the mobile rule is to avoid dense sub-status
 * grids, and a two-column grid at 375px is exactly that.
 */
export function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-gb-lg py-gb-xs">
      <span className="text-gb-sm text-fg-tertiary">{label}</span>
      <span className="text-gb-sm font-medium text-fg">{children}</span>
    </div>
  );
}
