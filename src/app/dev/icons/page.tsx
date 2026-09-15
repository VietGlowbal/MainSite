import { notFound } from 'next/navigation';
import { GLOWBAL_ICONS, GlowbalIcon, IconLabel } from '@/shared/ui';
import type { GlowbalIconName, GlowbalIconSize } from '@/shared/ui';

/**
 * Product icon reference. Development only.
 *
 * Every GLOWBAL_ICONS glyph on each surface its two tones resolve against, in
 * the app's real CSS environment — the check that a surface flips every icon
 * inside it with no per-call-site colour.
 *
 * Deliberately NOT a section of /dev/kitchen-sink: that page backs a screenshot
 * baseline, and 72 icons x 3 surfaces would change its height for a reason
 * unrelated to the tokens it guards.
 */

const NAMES = Object.keys(GLOWBAL_ICONS) as GlowbalIconName[];
const SIZES: readonly GlowbalIconSize[] = [16, 20, 24, 32, 40, 48];

const SURFACES = [
  {
    key: 'light',
    title: 'Light (default) — ink + brand accent',
    className: 'border border-line bg-surface text-fg',
    surface: undefined,
  },
  {
    key: 'dark',
    title: 'data-surface="dark" — white + lifted accent',
    className: 'bg-surface-inverse-deep text-fg-on-inverse',
    surface: 'dark',
  },
  {
    key: 'brand',
    title: 'data-surface="brand" — both tones follow the text colour',
    className: 'bg-brand text-on-brand',
    surface: 'brand',
  },
] as const;

export default function IconsPage() {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  return (
    <main
      data-no-auto-translate
      className="mx-auto max-w-gb-desktop bg-surface px-gb-xl py-gb-4xl text-fg md:px-gb-4xl"
    >
      <h1 className="font-display text-gb-display-md">GLOWBAL product icons</h1>
      <p className="mt-gb-md text-gb-md text-fg-tertiary">
        {NAMES.length} icons, 24px art, 1.8px stroke. The surface decides the colours; no icon
        below is passed one.
      </p>

      {SURFACES.map((s) => (
        <section
          key={s.key}
          data-surface={s.surface}
          className={`mt-gb-4xl rounded-gb-xl p-gb-3xl ${s.className}`}
        >
          <h2 className="mb-gb-xl text-gb-lg font-semibold">{s.title}</h2>
          <ul className="grid grid-cols-2 gap-gb-lg sm:grid-cols-4 lg:grid-cols-6">
            {NAMES.map((name) => (
              <li key={name} className="flex min-w-0 items-center gap-gb-md">
                <GlowbalIcon name={name} size={24} />
                <span className="truncate text-gb-xs">{name}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-gb-4xl">
        <h2 className="mb-gb-xl text-gb-lg font-semibold">Sizes — the six approved, nothing between</h2>
        <div className="flex flex-wrap items-end gap-gb-3xl">
          {SIZES.map((size) => (
            <span key={size} className="flex flex-col items-center gap-gb-md">
              <GlowbalIcon name="applicationTracker" size={size} />
              <span className="text-gb-xs text-fg-muted">{size}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="mt-gb-4xl">
        <h2 className="mb-gb-xl text-gb-lg font-semibold">tone=&quot;mono&quot;</h2>
        <div className="flex flex-wrap gap-gb-xl">
          {NAMES.slice(0, 12).map((name) => (
            <GlowbalIcon key={name} name={name} size={24} tone="mono" />
          ))}
        </div>
      </section>

      <section className="mt-gb-4xl grid gap-gb-3xl md:grid-cols-2">
        {(['light', 'dark'] as const).map((surface) => (
          <div
            key={surface}
            data-surface={surface}
            className={`flex flex-col gap-gb-3xl rounded-gb-xl p-gb-3xl ${
              surface === 'dark' ? 'bg-surface-inverse-deep text-fg-on-inverse' : 'border border-line bg-surface text-fg'
            }`}
          >
            <h2 className="text-gb-lg font-semibold">IconLabel — {surface}</h2>
            <div className="flex flex-col">
              <IconLabel name="applicationTracker" label="My Application" />
              <IconLabel name="checklist" label="Checklist" />
            </div>
            <IconLabel
              name="documentUpload"
              label="Transcript"
              description="Uploaded 12 Sep 2026 · PDF"
              density="row"
            />
            <IconLabel name="location" label="Demo City, Demo Country" density="meta" />
            <div className="grid grid-cols-2 gap-gb-3xl">
              <IconLabel
                layout="top"
                name="aiInsight"
                label="AI Insight"
                description="Placeholder body copy for the demo card."
              />
              <IconLabel layout="top" density="grid" name="compare" label="Compare" />
            </div>
            <IconLabel
              layout="top"
              density="empty"
              name="emptyState"
              label="Nothing saved yet"
              description="Demo empty state."
            />
          </div>
        ))}
      </section>
    </main>
  );
}
