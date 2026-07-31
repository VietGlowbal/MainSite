import { Panel } from '@/shared/ui';

/**
 * The pieces every /admin page repeats.
 *
 * No Figma frame exists for the console — see the note on Panel in
 * src/shared/ui/panel.tsx. These stay here rather than in shared/ui because
 * nothing outside /admin renders a data table or a role banner; the surface
 * itself (Panel, PanelHeader, StatTile, Badge) is the shared part.
 *
 * Five pages were each hand-rolling a section heading, a table chrome and a
 * status banner, in five slightly different greys. One definition each.
 */

/** The h2 + supporting line at the top of an /admin sub-page. */
export function AdminHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | undefined;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-gb-xl">
      <div className="flex min-w-0 flex-col gap-gb-xs">
        <h2 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {title}
        </h2>
        {description ? <p className="text-gb-sm text-fg-tertiary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Cell classes for the console's tables.
 *
 * Exported as constants rather than wrapped in <Th>/<Td> components: every
 * table here needs per-column alignment and a few need a second class on one
 * cell, and a component that takes a `className` to append to its own is just
 * a constant with extra steps.
 */
export const TH =
  'px-gb-xl py-gb-lg text-left text-gb-xs font-semibold uppercase tracking-wide text-fg-muted';
export const TD = 'px-gb-xl py-gb-lg align-top text-gb-sm text-fg-secondary';

/**
 * A table in a panel, scrollable sideways on a narrow screen.
 *
 * The overflow lives on a wrapper inside the panel, not on the panel: putting
 * it on the panel clips the rounded corners against the scroll container.
 */
export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <Panel padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">{children}</table>
      </div>
    </Panel>
  );
}

/** The "nothing here" row, spanning the whole table. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-gb-xl py-gb-6xl text-center text-gb-sm text-fg-muted">
        {children}
      </td>
    </tr>
  );
}

/**
 * A one-line result banner.
 *
 * `error` uses the error ramp, which tokens.css flags as not design-confirmed;
 * `success` reuses the safe tier pair rather than inventing a second green.
 */
export function Alert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const skin =
    tone === 'error'
      ? 'border-line-error bg-surface-error text-fg-error'
      : 'border-line bg-tier-safe text-on-tier-safe';
  return (
    <p role="status" className={`rounded-gb-xl border px-gb-xl py-gb-lg text-gb-sm ${skin}`}>
      {children}
    </p>
  );
}
