import { HERO_FLAVOUR, HERO_HEADLINE, HERO_UNIVERSITY } from '../domain';

/** The "Destination" step of the hierarchy in spec §17. */
export function ApplicationHero() {
  return (
    <div className="flex flex-col gap-gb-xs px-gb-xl lg:px-0">
      <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg lg:text-gb-display-md">
        {HERO_HEADLINE}
        <br />
        <span className="text-brand">{HERO_UNIVERSITY}</span>
      </h1>
      <p className="text-gb-sm font-medium text-fg-brand lg:text-gb-md">{HERO_FLAVOUR}</p>
    </div>
  );
}
