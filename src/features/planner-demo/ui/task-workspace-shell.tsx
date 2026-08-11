import { ICONS, KitIcon } from '@/shared/ui';

/**
 * Shared header for a task's GenUI workspace: a back link plus the task
 * title, then whatever the task type renders. No fixed positioning, no
 * backdrop — the workspace is a persistent panel now (spec §5, §12), not a
 * modal over the plan. The caller decides where this panel lives: the right
 * column on desktop, or a full-width swap on mobile (see
 * `planner-demo-app.tsx`), and wraps it in the enter/exit motion.
 */
export function TaskWorkspaceShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-gb-2xl">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-gb-xs text-gb-sm font-medium text-fg-tertiary transition-colors hover:text-fg-brand"
      >
        <KitIcon art={ICONS.arrowLeft} frame={16} />
        Back to tasks
      </button>
      <h2 className="font-display text-gb-display-xs font-semibold text-fg">{title}</h2>
      <div className="flex flex-1 flex-col gap-gb-2xl">{children}</div>
    </div>
  );
}
