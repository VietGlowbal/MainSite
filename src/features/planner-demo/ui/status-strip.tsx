/** Compact status strip, spec §6.C — three items maximum, no metrics beyond these. */
export function StatusStrip({
  progress,
  daysLeft,
  alerts,
}: {
  progress: number;
  daysLeft: number;
  alerts: number;
}) {
  const items = [
    `${progress}% complete`,
    `${daysLeft} days left`,
    alerts === 1 ? '1 thing needs attention' : `${alerts} things need attention`,
  ];

  return (
    <div className="mx-gb-xl flex items-center justify-between gap-gb-md rounded-gb-xl border border-line bg-surface px-gb-xl py-gb-lg lg:mx-0">
      {items.map((item, i) => (
        <div key={item} className="flex min-w-0 flex-1 items-center justify-center gap-gb-md">
          {i > 0 ? <span className="h-gb-2xl w-px shrink-0 bg-line" aria-hidden="true" /> : null}
          <span className="truncate text-center text-gb-sm font-medium text-fg-secondary">
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}
