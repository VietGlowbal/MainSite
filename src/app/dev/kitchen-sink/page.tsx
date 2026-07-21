import { notFound } from 'next/navigation';

/**
 * Design-system reference page. Development only.
 *
 * Renders every design token in the app's real CSS environment — which is the
 * whole point. A Storybook would give a *different* environment (its own CSS
 * pipeline, without the 5,600-line legacy stylesheet), so a component could
 * look right there and wrong in the product. This page cannot lie about that.
 *
 * It also backs the visual-regression spec in tests/e2e/kitchen-sink.spec.ts:
 * one screenshot here catches an accidental token change across the whole
 * system.
 *
 * Track B: add each `src/shared/ui` primitive below as you build it, in every
 * variant and size.
 */
export default function KitchenSinkPage() {
  // Hidden in production. ENABLE_DEV_ROUTES exists so the E2E suite — which
  // runs a production build on purpose — can still reach it. Real deploys must
  // never set it.
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  return (
    <main className="mx-auto max-w-gb-desktop bg-surface p-gb-4xl text-fg">
      <h1 className="font-display text-gb-display-md">GLOWBAL design tokens</h1>
      <p className="mt-gb-md text-gb-md text-fg-tertiary">
        Extracted from Figma. Brand values are placeholders until the ramp is bound.
      </p>

      <Section title="Neutral ramp">
        <div className="flex flex-wrap gap-gb-md">
          {NEUTRALS.map((n) => (
            <Swatch key={n.name} name={n.name} className={n.className} />
          ))}
        </div>
      </Section>

      <Section title="Brand ramp (placeholder)">
        <div className="flex flex-wrap gap-gb-md">
          <Swatch name="brand-300" className="bg-gb-brand-300" />
          <Swatch name="brand-500" className="bg-gb-brand-500" />
          <Swatch name="brand-600" className="bg-gb-brand-600" />
          <Swatch name="brand-700" className="bg-gb-brand-700" />
        </div>
      </Section>

      <Section title="Semantic colours">
        <div className="flex flex-wrap gap-gb-md">
          <Swatch name="surface" className="bg-surface border border-line" />
          <Swatch name="surface-hover" className="bg-surface-hover" />
          <Swatch name="surface-muted" className="bg-surface-muted" />
          <Swatch name="surface-inverse" className="bg-surface-inverse" />
          <Swatch name="brand" className="bg-brand" />
        </div>
        <div className="mt-gb-lg space-y-gb-xs">
          <p className="text-gb-md text-fg">text-fg — primary</p>
          <p className="text-gb-md text-fg-secondary">text-fg-secondary</p>
          <p className="text-gb-md text-fg-tertiary">text-fg-tertiary</p>
          <p className="text-gb-md text-fg-muted">text-fg-muted</p>
        </div>
      </Section>

      <Section title="Type scale">
        <div className="space-y-gb-md">
          <p className="font-display text-gb-display-xl">display-xl 60/72</p>
          <p className="font-display text-gb-display-md">display-md 36/44</p>
          <p className="font-display text-gb-display-sm">display-sm 30/38</p>
          <p className="font-display text-gb-display-xs">display-xs 24/32</p>
          <p className="text-gb-xl">text-xl 20/30</p>
          <p className="text-gb-lg">text-lg 18/28</p>
          <p className="text-gb-md">text-md 16/24 — Tiếng Việt có dấu</p>
          <p className="text-gb-sm">text-sm 14/20</p>
          <p className="text-gb-xs">text-xs 12/18</p>
        </div>
      </Section>

      <Section title="Radius">
        {/* Class names are written out in full: Tailwind extracts literal
            strings from source, so an interpolated `rounded-gb-${r}` would
            never generate a utility. */}
        <div className="flex flex-wrap items-end gap-gb-md">
          {RADII.map((r) => (
            <div key={r.name} className="text-center">
              <div className={`h-16 w-16 bg-surface-inverse ${r.className}`} />
              <span className="mt-gb-xs block text-gb-xs text-fg-muted">{r.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing">
        <div className="space-y-gb-xs">
          {SPACING.map((s) => (
            <div key={s.name} className="flex items-center gap-gb-md">
              <span className="w-16 text-gb-xs text-fg-muted">{s.name}</span>
              <div className={`h-3 bg-brand ${s.className}`} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadows">
        <div className="flex flex-wrap gap-gb-3xl">
          <div className="rounded-gb-xl bg-surface p-gb-xl shadow-gb-xs">shadow-gb-xs</div>
          <div className="rounded-gb-xl bg-surface p-gb-xl shadow-gb-lg">shadow-gb-lg</div>
        </div>
      </Section>

      <Section title="Primitives (src/shared/ui)">
        <p className="text-gb-sm text-fg-muted">
          Empty until Track B builds them. Add each component here in every variant.
        </p>
      </Section>
    </main>
  );
}

const NEUTRALS = [
  { name: '950', className: 'bg-gb-neutral-950' },
  { name: '900', className: 'bg-gb-neutral-900' },
  { name: '700', className: 'bg-gb-neutral-700' },
  { name: '600', className: 'bg-gb-neutral-600' },
  { name: '500', className: 'bg-gb-neutral-500' },
  { name: '400', className: 'bg-gb-neutral-400' },
  { name: '300', className: 'bg-gb-neutral-300' },
  { name: '200', className: 'bg-gb-neutral-200' },
  { name: '50', className: 'bg-gb-neutral-50' },
  { name: '0', className: 'bg-gb-neutral-0 border border-line' },
];

const RADII = [
  { name: 'none', className: 'rounded-gb-none' },
  { name: 'sm', className: 'rounded-gb-sm' },
  { name: 'md', className: 'rounded-gb-md' },
  { name: 'lg', className: 'rounded-gb-lg' },
  { name: 'xl', className: 'rounded-gb-xl' },
  { name: 'full', className: 'rounded-gb-full' },
];

const SPACING = [
  { name: 'xxs', className: 'w-gb-xxs' },
  { name: 'xs', className: 'w-gb-xs' },
  { name: 'sm', className: 'w-gb-sm' },
  { name: 'md', className: 'w-gb-md' },
  { name: 'lg', className: 'w-gb-lg' },
  { name: 'xl', className: 'w-gb-xl' },
  { name: '2xl', className: 'w-gb-2xl' },
  { name: '3xl', className: 'w-gb-3xl' },
  { name: '4xl', className: 'w-gb-4xl' },
  { name: '5xl', className: 'w-gb-5xl' },
  { name: '6xl', className: 'w-gb-6xl' },
  { name: '7xl', className: 'w-gb-7xl' },
  { name: '9xl', className: 'w-gb-9xl' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-gb-6xl border-t border-line pt-gb-3xl">
      <h2 className="mb-gb-xl font-display text-gb-display-xs">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="text-center">
      <div className={`h-16 w-16 rounded-gb-md ${className}`} />
      <span className="mt-gb-xs block text-gb-xs text-fg-muted">{name}</span>
    </div>
  );
}
