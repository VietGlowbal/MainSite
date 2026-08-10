import { ICONS, KitIcon } from '@/shared/ui';

/**
 * Shared shell for a full-screen task step (spec §7: "I prefer full-screen
 * mobile step"). Fixed over the planner home rather than a route change, so
 * closing it is instant and the planner underneath keeps its scroll position.
 */
export function TaskWorkspaceShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-surface">
      <div className="flex w-full max-w-[420px] flex-col pb-gb-9xl">
        <header className="flex items-center gap-gb-sm px-gb-xl pb-gb-lg pt-gb-xl">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to your plan"
            className="flex size-[28px] shrink-0 items-center justify-center rounded-gb-full text-fg-brand transition-colors hover:bg-brand-subtle"
          >
            <KitIcon art={ICONS.arrowLeft} frame={20} />
          </button>
          <span className="truncate text-gb-sm font-semibold text-fg-brand">{title}</span>
        </header>
        <div className="flex flex-1 flex-col gap-gb-2xl px-gb-xl">{children}</div>
      </div>
    </div>
  );
}
