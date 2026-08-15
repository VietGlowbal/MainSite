import { MetricBar, type MetricBarTone } from './metric-bar';

export type HorizontalBarChartDatum = {
  key: string;
  label: string;
  /** 0-100, or null when the underlying framework has nothing to report. */
  value: number | null;
  caption?: string | undefined;
};

/**
 * A stack of `MetricBar` rows sharing one accessible name — the
 * "Narrative identity signals" / "Pattern frequency" / "Theme maturity"
 * bar charts across the Personal Report (implementation spec §7, §12).
 */
export function HorizontalBarChart({
  data,
  ariaLabel,
  tone = 'brand',
  className,
}: {
  data: readonly HorizontalBarChartDatum[];
  ariaLabel: string;
  tone?: MetricBarTone;
  className?: string | undefined;
}) {
  return (
    <ul aria-label={ariaLabel} className={`flex flex-col gap-gb-lg ${className ?? ''}`}>
      {data.map((datum) => (
        <li key={datum.key}>
          <MetricBar label={datum.label} value={datum.value} caption={datum.caption} tone={tone} />
        </li>
      ))}
    </ul>
  );
}
