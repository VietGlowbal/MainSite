import { PLANNER_VIEWS, type PlannerView } from '../domain';

const VIEW_LABEL: Record<PlannerView, string> = {
  tasks: 'Tasks',
  calendar: 'Calendar',
  kanban: 'Kanban',
  outputs: 'Outputs',
};

/**
 * Four ways of working with the same plan, not four products (spec §9).
 * Lives directly under the Next Task card in the left column.
 */
export function PlannerViewSwitch({
  view,
  onChange,
}: {
  view: PlannerView;
  onChange: (view: PlannerView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Planner view"
      className="grid grid-cols-4 gap-gb-xxs rounded-gb-lg border border-line bg-surface-muted p-gb-xxs"
    >
      {PLANNER_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={v === view}
          onClick={() => onChange(v)}
          className={`rounded-gb-md px-gb-sm py-gb-sm text-center text-gb-xs font-semibold transition-colors ${
            v === view ? 'bg-surface text-fg-brand shadow-gb-xs' : 'text-fg-tertiary hover:text-fg'
          }`}
        >
          {VIEW_LABEL[v]}
        </button>
      ))}
    </div>
  );
}
