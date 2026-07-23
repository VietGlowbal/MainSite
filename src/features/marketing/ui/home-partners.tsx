import Image from 'next/image';
import { PARTNER_HEADING_CENTER_Y, PARTNER_LOGOS, PARTNER_STAGE } from './partner-logos';

/**
 * Partner logo wall — Figma 104:7135 (1440x977, black).
 *
 * Unlike every other section on the page this one has no auto-layout: eleven
 * tiles sit at hand-placed coordinates with the heading floating in the lane
 * the designer left clear across the middle. There is no arrangement to infer,
 * so the desktop build reproduces the frame as a fixed-ratio stage and turns
 * every coordinate into a percentage of it. The whole composition then scales
 * as one piece, which is the only way the heading is guaranteed never to
 * collide with a tile — including the text scaling, hence the cqw font size.
 *
 * That trick stops being sensible once the stage is narrow: at 700px the tiles
 * are 50px and the heading 23px. So below `lg` the scatter is dropped for a
 * centred wrap, at 88px — which is also the only place these images are shown
 * at something close to their real 90px resolution.
 *
 * The two layouts share one DOM. Positions ride in as custom properties because
 * they vary per tile and inline styles cannot carry a breakpoint; the `lg:`
 * utilities are what decide whether they are read at all.
 *
 * Note the section does NOT use `Section`: that wraps a 1280 container, and
 * these tiles deliberately run outside it (x=168 to x=1373).
 */
export function HomePartners() {
  return (
    <section className="bg-surface-inverse-strong text-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-gb-6xl px-gb-xl py-gb-9xl lg:relative lg:block lg:aspect-[1440/977] lg:px-0 lg:py-0 lg:[container-type:inline-size]">
        {/* 3.3333cqw is 48/1440 and 4.4444cqw is 64/1440 — the design's font size
            and leading, expressed against the stage so they scale with it. */}
        <h2
          className="text-center font-display text-gb-display-sm font-semibold tracking-gb-display-open lg:absolute lg:left-1/2 lg:top-[var(--heading-y)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:whitespace-nowrap lg:text-[3.3333cqw] lg:leading-[4.4444cqw]"
          style={{ '--heading-y': `${PARTNER_HEADING_CENTER_Y * 100}%` } as React.CSSProperties}
        >
          Our featured partners
        </h2>
        <ul className="flex flex-wrap justify-center gap-gb-3xl lg:contents">
          {PARTNER_LOGOS.map((logo) => (
            <li
              key={logo.name}
              className="relative aspect-square w-[88px] overflow-hidden rounded-gb-md lg:absolute lg:left-[var(--tile-x)] lg:top-[var(--tile-y)] lg:w-[var(--tile-w)]"
              style={
                {
                  '--tile-x': `${(logo.x / PARTNER_STAGE.width) * 100}%`,
                  '--tile-y': `${(logo.y / PARTNER_STAGE.height) * 100}%`,
                  '--tile-w': `${(logo.size / PARTNER_STAGE.width) * 100}%`,
                } as React.CSSProperties
              }
            >
              <Image
                src={logo.src}
                alt={logo.name}
                fill
                sizes="(min-width: 1024px) 10vw, 88px"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
