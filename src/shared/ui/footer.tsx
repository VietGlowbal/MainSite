import Link from 'next/link';
import { Badge } from './badge';
import { Container } from './container';
import { RatingsBadge } from './ratings-badge';

/**
 * Footer — Figma 104:7404 (1440x444), the site's bottom chrome.
 *
 * Appears on nearly every frame the designer drew (Home, Pricing, About, Blog,
 * Trang lưu), which is why it lives in shared/ui alongside TopNav and takes its
 * link lists as props: the component owns the layout, the caller owns the
 * routes. Feature code should not fork it.
 *
 * The band is dark on every page, including the light ones, so it uses the
 * dark-band token set (`surface-inverse-deep` + `fg-on-inverse-*`) rather than
 * the light semantics. See the "Dark-band foregrounds" block in tokens.css for
 * why those exist as their own vocabulary.
 *
 * Two deliberate departures from the mockup, both noted rather than silently
 * applied:
 *  - The bottom bar's container is `pl-24 pr-80` in Figma (104:7419) while
 *    every other container in the file is a symmetric 32. Treated as a slip and
 *    rendered with the standard `Container`.
 *  - Figma pins the link block at a hard 800px and the tagline at 342px. Only
 *    the 1440 frame is drawn, so those become `lg:` measurements and the block
 *    wraps to a stack below that — there is no mobile footer frame to follow.
 */

export type FooterLink = {
  href: string;
  /** Already-translated label. */
  label: string;
  /** Optional pill after the label, e.g. "New" (Figma I104:7413;3288:570947). */
  badge?: string;
};

export type FooterColumn = {
  heading: string;
  links: readonly FooterLink[];
};

export type FooterSocial = {
  href: string;
  /** Accessible name — the mark itself is aria-hidden. */
  label: string;
  /**
   * The mark, sized to a 20px frame. A node rather than a `BrandIconArt`
   * because the row is not uniform: the kit's marks are single filled paths,
   * but Instagram has no kit art and is a three-shape outline. See InstagramMark
   * in ./icons.
   */
  icon: React.ReactNode;
};

type Props = {
  /** Wordmark, 28px tall in the design. */
  logo: React.ReactNode;
  /** One-line product description under the wordmark. */
  tagline: string;
  columns: readonly FooterColumn[];
  social: readonly FooterSocial[];
  /** Full copyright line, already translated. */
  copyright: string;
  /**
   * The Ratings badge (Figma 104:7411). Optional because it makes a public
   * claim about the product — omit it rather than ship a number that is not
   * true. See the ⚠️ on RatingsBadge.
   */
  ratings?: { headline: string; supporting: string } | undefined;
};

export function Footer({ logo, tagline, columns, social, copyright, ratings }: Props) {
  return (
    <footer className="bg-surface-inverse-deep">
      <div className="pt-gb-7xl pb-gb-6xl">
        <Container className="flex flex-col gap-gb-6xl lg:flex-row lg:gap-gb-7xl">
          <div className="flex flex-col gap-gb-3xl lg:min-w-0 lg:flex-1">
            {logo}
            {/* 342px in the design; the nearest container token is 480, which
                is too wide, so the measure stays a literal. */}
            <p className="max-w-[342px] text-gb-md text-fg-on-inverse-muted">{tagline}</p>
            {ratings ? (
              <RatingsBadge headline={ratings.headline} supporting={ratings.supporting} />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-gb-4xl lg:w-[800px] lg:shrink-0 lg:justify-end">
            {columns.map((column) => (
              <div
                key={column.heading}
                className="flex min-w-[96px] flex-1 flex-col gap-gb-xl lg:w-[240px] lg:flex-none"
              >
                <h2 className="text-gb-md font-semibold text-fg-on-inverse-secondary">
                  {column.heading}
                </h2>
                <ul className="flex flex-col gap-gb-lg">
                  {column.links.map((link) => (
                    <li key={link.href} className="flex items-center gap-gb-sm">
                      <Link
                        href={link.href}
                        className="rounded-gb-sm text-gb-sm font-semibold text-fg-on-inverse-muted transition-colors hover:text-fg-on-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {link.label}
                      </Link>
                      {link.badge ? <Badge>{link.badge}</Badge> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </div>

      <div className="py-gb-6xl">
        <Container className="flex flex-wrap items-center justify-between gap-x-gb-4xl gap-y-gb-3xl">
          <p className="text-gb-sm text-fg-on-inverse-muted">{copyright}</p>
          <div className="flex items-center gap-gb-xl">
            {social.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={item.label}
                className="flex size-gb-2xl items-center justify-center rounded-gb-sm text-fg-muted transition-colors hover:text-fg-on-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {item.icon}
              </a>
            ))}
          </div>
        </Container>
      </div>
    </footer>
  );
}
