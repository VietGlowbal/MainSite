'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/shared/ui';
import type { Task } from '../domain';

type ColumnKey = 'todo' | 'suggested' | 'in_progress' | 'done';

const COLUMNS: readonly { key: ColumnKey; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'suggested', label: 'Suggested this week' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_LABEL: Record<NonNullable<Task['priority']>, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function initialColumn(task: Task, suggestedIds: ReadonlySet<string>): ColumnKey {
  if (task.status === 'complete') return 'done';
  if (task.status === 'in_progress') return 'in_progress';
  if (suggestedIds.has(task.id)) return 'suggested';
  return 'todo';
}

/**
 * Same tasks as everywhere else (spec §16), just spatially — students, not
 * software teams, so no assignees/sprints/epics. Drag-and-drop is native
 * HTML5 DnD; a demo card sort doesn't need a dependency for it.
 */
export function KanbanView({
  tasks,
  onSelectTask,
}: {
  tasks: readonly Task[];
  onSelectTask: (taskId: string) => void;
}) {
  const visibleTasks = useMemo(() => tasks.filter((t) => t.status !== 'locked'), [tasks]);

  const suggestedIds = useMemo(() => {
    const ids = new Set<string>();
    const current = visibleTasks.find((t) => t.status === 'recommended' || t.status === 'in_progress');
    if (current) ids.add(current.id);
    for (const t of visibleTasks) {
      if (ids.size >= 3) break;
      if (t.status === 'not_started' && t.priority === 'high') ids.add(t.id);
    }
    return ids;
  }, [visibleTasks]);

  const buildColumns = useMemo(
    () => (): Record<ColumnKey, string[]> => {
      const map: Record<ColumnKey, string[]> = { todo: [], suggested: [], in_progress: [], done: [] };
      for (const t of visibleTasks) map[initialColumn(t, suggestedIds)].push(t.id);
      return map;
    },
    [visibleTasks, suggestedIds],
  );

  const [columns, setColumns] = useState<Record<ColumnKey, string[]>>(buildColumns);
  const resetKey = visibleTasks.map((t) => `${t.id}:${t.status}`).join('|');
  // Re-seed the board when the underlying tasks change — a demo-state switch
  // or completing a task elsewhere shouldn't leave stale cards on the board.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resync to external application state, not a derived value
  useEffect(() => setColumns(buildColumns()), [resetKey, buildColumns]);

  const byId = useMemo(() => new Map(visibleTasks.map((t) => [t.id, t])), [visibleTasks]);

  function handleDrop(target: ColumnKey, taskId: string) {
    setColumns((prev) => {
      const next: Record<ColumnKey, string[]> = {
        todo: prev.todo.filter((id) => id !== taskId),
        suggested: prev.suggested.filter((id) => id !== taskId),
        in_progress: prev.in_progress.filter((id) => id !== taskId),
        done: prev.done.filter((id) => id !== taskId),
      };
      next[target] = [...next[target], taskId];
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 gap-gb-lg sm:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const taskId = e.dataTransfer.getData('text/plain');
            if (taskId) handleDrop(col.key, taskId);
          }}
          className="flex flex-col gap-gb-md rounded-gb-2xl border border-line bg-surface-muted p-gb-lg"
        >
          <div className="flex items-center justify-between gap-gb-md">
            <p className="text-gb-sm font-semibold text-fg">{col.label}</p>
            <span className="text-gb-xs text-fg-muted">{columns[col.key].length}</span>
          </div>

          <div className="flex flex-col gap-gb-sm">
            {columns[col.key].map((taskId) => {
              const task = byId.get(taskId);
              if (!task) return null;
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                  onClick={() => onSelectTask(task.id)}
                  className="cursor-grab rounded-gb-xl border border-line bg-surface p-gb-md text-left shadow-gb-xs transition-transform hover:-translate-y-0.5 active:cursor-grabbing"
                >
                  <p className="mb-gb-sm text-gb-sm font-medium text-fg">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-gb-xs">
                    <Badge variant="neutral" className="text-[10px]">
                      Phase {task.phaseNumber}
                    </Badge>
                    {task.priority ? (
                      <Badge variant="neutral" className="text-[10px]">
                        {PRIORITY_LABEL[task.priority]}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
