import { Badge, ICONS, KitIcon } from '@/shared/ui';
import type { Task } from '../domain';

function StatusMark({ status }: { status: Task['status'] }) {
  if (status === 'complete') {
    return (
      <span className="flex size-[20px] shrink-0 items-center justify-center text-on-tier-safe">
        <KitIcon art={ICONS.checkCircle} frame={20} />
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span className="flex size-[20px] shrink-0 items-center justify-center">
        <span className="size-[10px] rounded-gb-full bg-brand" />
      </span>
    );
  }
  return (
    <span className="flex size-[20px] shrink-0 items-center justify-center">
      <span className="size-[10px] rounded-gb-full border border-line-strong" />
    </span>
  );
}

export function TaskRow({ task, onOpen }: { task: Task; onOpen: (taskId: string) => void }) {
  const interactive = task.status === 'current' || task.status === 'todo';
  const Wrapper = interactive ? 'button' : 'div';

  return (
    <Wrapper
      {...(interactive ? { type: 'button' as const, onClick: () => onOpen(task.id) } : {})}
      className={`flex w-full items-center gap-gb-lg rounded-gb-lg px-gb-md py-gb-sm text-left ${
        interactive ? 'transition-colors hover:bg-surface-hover' : ''
      }`}
    >
      <StatusMark status={task.status} />
      <span
        className={`min-w-0 flex-1 text-gb-md ${
          task.status === 'complete' ? 'text-fg-tertiary line-through decoration-line-strong' : 'text-fg'
        }`}
      >
        {task.title}
      </span>
      {task.status === 'complete' && task.completionNote ? (
        <span className="shrink-0 text-gb-xs font-medium text-on-tier-safe">
          ✨ {task.completionNote}
        </span>
      ) : task.status === 'current' ? (
        <Badge variant="brand-subtle" className="shrink-0">
          Current
        </Badge>
      ) : null}
    </Wrapper>
  );
}
