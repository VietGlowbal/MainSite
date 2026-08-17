'use client';

import { T, useT } from '@/lib/i18n';

export function StrategyHubSoundToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      title={t('Toggle sound effects')}
      className={[
        'inline-flex h-gb-5xl items-center gap-gb-sm rounded-gb-full border px-gb-lg text-gb-xs font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        enabled
          ? 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
          : 'border-line bg-surface-muted text-fg-muted hover:bg-surface-hover',
      ].join(' ')}
    >
      <span aria-hidden="true">{enabled ? '🔊' : '🔇'}</span>
      <span>
        <T k={enabled ? 'Sounds on' : 'Sounds off'} />
      </span>
    </button>
  );
}
