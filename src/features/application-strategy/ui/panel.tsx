/**
 * The card treatment the Application Strategy screens use.
 *
 * WHY THIS IS NOW FOUR LINES. It used to reimplement `Panel` and `PanelHeader`,
 * on the reasoning that `shared/ui` had no card at all. That was true when it
 * was written and stopped being true a few days later: `shared/ui/panel.tsx`
 * landed for the /profile and /admin consoles. Two components with the same
 * radius, border and padding but separate implementations is precisely how the
 * border colour ends up different on one page, so the shared one now carries an
 * `elevation="flat"` variant for this feature's "no shadow" rule and the copy
 * here is gone.
 *
 * `StrategyPanel` is a preset, not a wrapper with new behaviour: it pins
 * `elevation="flat"` and the column gap every screen here wants, so fifteen call
 * sites cannot each decide. Reach for `Panel` from `@/shared/ui` directly if you
 * need something other than that.
 */
import { Panel, type PanelPadding } from '@/shared/ui';

export function StrategyPanel({
  children,
  className,
  padding = 'md',
  as = 'section',
}: {
  children: React.ReactNode;
  className?: string | undefined;
  padding?: PanelPadding | undefined;
  as?: 'div' | 'section' | 'article' | 'li' | undefined;
}) {
  return (
    <Panel
      elevation="flat"
      padding={padding}
      as={as}
      className={`flex flex-col gap-gb-2xl${className ? ` ${className}` : ''}`}
    >
      {children}
    </Panel>
  );
}

/**
 * A label/value row for the sub-status lists on the workspace cards.
 *
 * Rows rather than a grid because the mobile rule is to avoid dense sub-status
 * grids, and a two-column grid at 375px is exactly that. No equivalent exists in
 * shared/ui and it is specific to these cards, so it stays here.
 */
export function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-gb-lg py-gb-xs">
      <span className="text-gb-sm text-fg-tertiary">{label}</span>
      <span className="text-gb-sm font-medium text-fg">{children}</span>
    </div>
  );
}
