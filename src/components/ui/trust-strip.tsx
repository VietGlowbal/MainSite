/**
 * Glowbal TrustStrip — compact horizontal row of trust signals.
 *
 * Sits below page heroes / above content to make data sourcing and
 * security transparent. Examples:
 *
 *   <TrustStrip
 *     items={[
 *       { icon: '✓', label: 'Verified university data' },
 *       { icon: '⏱', label: 'Updated May 2026' },
 *       { icon: '🔒', label: 'Secure payments via Stripe' },
 *       { icon: '📊', label: 'Sources: QS, university websites' },
 *     ]}
 *   />
 *
 * Items are visually muted on purpose — this is supporting evidence,
 * not the headline.
 */

import type { ReactNode } from 'react';

export interface TrustStripItem {
  icon?: ReactNode;
  label: string;
  /** Optional short hover-tooltip / aria description. */
  hint?: string;
}

export function TrustStrip({
  items,
  className = '',
  align = 'start',
}: {
  items: TrustStripItem[];
  className?: string;
  align?: 'start' | 'center' | 'between';
}) {
  if (items.length === 0) return null;
  const justify =
    align === 'center'
      ? 'justify-center'
      : align === 'between'
        ? 'justify-between'
        : 'justify-start';

  return (
    <ul
      className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 ${justify} ${className}`}
    >
      {items.map((item, i) => (
        <li
          key={i}
          className="inline-flex items-center gap-1.5"
          title={item.hint}
        >
          {item.icon ? (
            <span aria-hidden className="text-slate-400">
              {item.icon}
            </span>
          ) : null}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
