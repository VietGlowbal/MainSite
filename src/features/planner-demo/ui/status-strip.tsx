/**
 * Compact status container (spec §6) — sits beside the hero on desktop, not
 * a full-width bar. Three figures only: progress, deadline, attention.
 * Progress is completion of the GlowBal plan, never admissions probability.
 */
export function StatusStrip({
  progress,
  daysLeft,
  alerts,
}: {
  progress: number;
  daysLeft: number;
  alerts: number;
}) {
  const items: readonly { icon: string; value: string; label: string }[] = [
    { icon: '📊', value: `${progress}%`, label: 'Application progress' },
    { icon: '📅', value: `${daysLeft} days`, label: 'Days until deadline' },
    {
      icon: '🔔',
      value: alerts === 1 ? '1 task' : `${alerts} tasks`,
      label: 'Needs your attention',
    },
  ];

  return (
    <div className="flex flex-col divide-y divide-line rounded-gb-2xl border border-line bg-surface sm:flex-row sm:divide-x sm:divide-y-0 lg:w-fit">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-gb-md px-gb-xl py-gb-lg">
          <span className="flex size-[36px] shrink-0 items-center justify-center rounded-gb-full bg-brand-subtle text-gb-md">
            {item.icon}
          </span>
          <div className="flex flex-col">
            <span className="text-gb-lg font-semibold text-fg">{item.value}</span>
            <span className="whitespace-nowrap text-gb-xs text-fg-tertiary">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
