'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { MarketingNavigation } from '@/components/marketing-navigation';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/ui';
import type { GeoGuide } from '@/lib/geo-content';
import {
  Badge,
  Button,
  Container,
  Footer,
  ICONS,
  Input,
  KitIcon,
  Pagination,
  SearchMark,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * /news — the Blog list, built from Figma 153:18266 ("Blog page header").
 *
 * THIS PAGE IS A MERGE. Until 31/07 the same `listGeoGuides()` data was served
 * by two routes: `/news` (the pre-redesign layout — hero illustration, featured
 * article, search, grid/list toggle, trending sidebar) and `/guides` (this
 * design). The product owner folded them into one: the redesign is the UI, and
 * `/news` is the surviving URL because it is the one the app navigation, the
 * article breadcrumbs and the JSON-LD have always pointed at. `/guides` and
 * `/guides/:slug` now 308 to here and to `/news/:slug` — see next.config.ts.
 *
 * The design is a light TopNav, a grey header band (eyebrow / display heading /
 * supporting text), a row of topic tabs, a two-column card grid, Pagination and
 * the shared Footer. Everything here maps onto primitives that already exist;
 * the only new art is ICONS.arrowUpRight (Figma 2:31009) and the three alpha
 * overlay tokens the card's frosted attribution strip needs.
 *
 * Three places where real data forced a decision, all deliberate:
 *
 *  1. NO AUTHOR. The mockup's attribution strip reads "Olivia Rhye / 20 Jan
 *     2027" over a byline; GeoGuide has no author field, and inventing one is
 *     the same class of mistake as the fake testimonials on Home. The strip
 *     keeps its two-line shape with the two facts the data does have — date,
 *     then reading time.
 *
 *  2. TABS ARE DATA, NOT A LIST. The frame hardcodes five categories
 *     (Scholarships, Visa & Application, Student Life, Student Stories). The
 *     real topics come from listGeoTopics(), which already returns "All topics"
 *     first — that is the design's "View all" tab, so the two line up. A tab
 *     for a topic with no posts behind it would be a dead control.
 *
 *  3. THE SUBSCRIBE ROW IS AN ADDITION. The frame's supporting text says
 *     "Subscribe to learn about new product features…" and then draws no
 *     control, so the copy is a dangling instruction. This page is also one of
 *     only two places on the site wired to POST /api/newsletter/subscribe, so
 *     shipping the frame literally would delete working functionality to
 *     reproduce placeholder text. The row goes in the column the design's own
 *     copy points at. Ask the designer to draw it (or to drop the sentence).
 *
 * TWO THINGS CARRIED OVER FROM THE OLD /news, on the owner's instruction, both
 * undrawn and marked below:
 *
 *  - SEARCH. The old page filtered on title/excerpt/topic/tags and it worked;
 *    the redesign draws topic tabs only. Dropping a working control to match a
 *    frame is the same trade as (3), so it sits in the tab row.
 *  - FEATURED. The newest post of the current topic gets the full container
 *    width above the grid. It is the one piece of hierarchy the flat 2-up grid
 *    has none of, and the old page had it.
 *
 * Dropped from the old /news and NOT carried over: the "Save for later" and
 * sort controls (both were buttons with no handler — dead UI, not features),
 * the grid/list toggle, the trending sidebar (its ranking was a hand-written
 * topic weighting, not a real signal), and the orbiting-globe hero.
 *
 * i18n: no `t()` here. Static copy is written in English and translated by the
 * dictionary in src/lib/i18n-dictionary.ts, which DomTranslator matches against
 * the exact trimmed text of a node — the same pattern the landing page uses.
 * That also means article titles and excerpts, which can never be dictionary
 * keys, still reach /api/translate in one batched call. Keep the strings below
 * character-identical to their dictionary entries.
 */

/** 2 columns x 3 rows — Figma 153:18283 renders exactly six cards. */
const PAGE_SIZE = 6;

/** listGeoTopics() puts this first; the design labels that tab "View all". */
const ALL_TOPICS = 'All topics';

/**
 * `publishedAt` is a date with no time ("2027-01-20"), which `new Date()` reads
 * as UTC midnight — so a reader west of Greenwich would see the previous day
 * while the server rendered the right one, and React would report a hydration
 * mismatch. Anchoring at noon UTC puts every timezone on the same calendar day.
 */
function formatDate(value: string) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The date / reading-time pair, as two nodes rather than one string.
 *
 * "5 min read" interpolated into a single text node can never match a
 * dictionary key, so it would make a round trip to /api/translate for every
 * distinct duration. Split, the number passes through untouched (DomTranslator
 * skips text with no letters) and "min read" is a free dictionary hit.
 */
function PostMeta({ guide, className }: { guide: GeoGuide; className?: string }) {
  return (
    <span className={className}>
      {formatDate(guide.publishedAt)}
      <span aria-hidden="true"> · </span>
      {guide.readingTimeMinutes} <span>min read</span>
    </span>
  );
}

/**
 * Figma "Blog post card" (153:18284).
 *
 * The cover is square-cornered on purpose — the instance has `overflow-clip`
 * with no radius, unlike every other card in the file.
 */
function BlogPostCard({ guide }: { guide: GeoGuide }) {
  const href = `/news/${guide.slug}`;
  return (
    <article className="flex flex-col gap-gb-xl">
      <Link href={href} className="group relative block aspect-[384/256] w-full overflow-clip border-[0.5px] border-line-on-image">
        <Image
          src={guide.heroImage}
          alt=""
          fill
          sizes="(min-width: 1024px) 592px, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Attribution strip: a frosted panel over a bottom-up scrim, so white
            text stays legible whatever the photo underneath is doing. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-scrim">
          <div className="border-t border-surface-frosted bg-surface-frosted p-gb-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-gb-3xl text-gb-sm text-white">
              <div className="flex flex-col">
                <span className="font-semibold">{formatDate(guide.publishedAt)}</span>
                <span>
                  {guide.readingTimeMinutes} <span>min read</span>
                </span>
              </div>
              <span className="shrink-0 font-semibold">{guide.topic}</span>
            </div>
          </div>
        </div>
      </Link>

      <div className="flex flex-col gap-gb-2xl">
        <div className="flex flex-col gap-gb-xs">
          {/* Clamped to two lines rather than the mockup's one: real titles run
              to 60+ characters, and a single line would cut most of them off
              mid-word. The clamp is what keeps the grid rows even. */}
          <h3 className="line-clamp-2 text-gb-lg font-semibold text-fg">
            <Link href={href} className="hover:text-fg-brand">
              {guide.title}
            </Link>
          </h3>
          <p className="line-clamp-2 text-gb-md text-fg-tertiary">{guide.excerpt}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-gb-sm text-gb-md font-semibold text-brand hover:text-brand-hover"
        >
          Read post
          <KitIcon art={ICONS.arrowUpRight} frame={20} />
        </Link>
      </div>
    </article>
  );
}

/**
 * The lead post — see the FEATURED note in the file header. Undrawn.
 *
 * Built from the same parts as the card above rather than a new visual
 * language: same cover treatment, same "Read post" affordance, one type step
 * up and turned on its side. The frosted strip is dropped here because the
 * facts it carries have room to sit in the text column at this size.
 */
function FeaturedPost({ guide }: { guide: GeoGuide }) {
  const href = `/news/${guide.slug}`;
  return (
    <article className="flex flex-col gap-gb-4xl lg:flex-row lg:items-center lg:gap-gb-6xl">
      <Link
        href={href}
        className="group relative block aspect-[592/400] w-full shrink-0 overflow-clip border-[0.5px] border-line-on-image lg:w-1/2"
      >
        <Image
          src={guide.heroImage}
          alt=""
          fill
          sizes="(min-width: 1024px) 592px, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          priority
        />
      </Link>

      <div className="flex flex-col gap-gb-2xl lg:w-1/2">
        <div className="flex flex-wrap items-center gap-gb-lg">
          <Badge variant="brand-chip">Featured</Badge>
          <span className="text-gb-sm font-semibold text-fg-muted">{guide.topic}</span>
        </div>
        <div className="flex flex-col gap-gb-lg">
          <h2 className="font-display text-gb-display-xs font-medium tracking-gb-display-tight text-fg lg:text-gb-display-sm">
            <Link href={href} className="hover:text-fg-brand">
              {guide.title}
            </Link>
          </h2>
          <p className="line-clamp-3 text-gb-lg text-fg-tertiary">{guide.excerpt}</p>
        </div>
        <PostMeta guide={guide} className="text-gb-sm text-fg-muted" />
        <Link
          href={href}
          className="inline-flex w-fit items-center gap-gb-sm text-gb-md font-semibold text-brand hover:text-brand-hover"
        >
          Read post
          <KitIcon art={ICONS.arrowUpRight} frame={20} />
        </Link>
      </div>
    </article>
  );
}

/** See note (3) in the file header — an addition, not a frame. */
function SubscribeRow() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  useLoadingIndicator(status === 'loading', 'Signing you up');
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'news_page' }),
      });
      const data = (await response.json()) as { error?: string; alreadySubscribed?: boolean };
      if (response.ok) {
        setStatus('success');
        setMessage(
          data.alreadySubscribed
            ? "You're already subscribed!"
            : 'Successfully subscribed! Check your email.',
        );
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Failed to subscribe. Please try again.');
    }
  }

  const busy = status === 'loading' || status === 'success';

  return (
    /* method="post" for the same reason as the auth form: a submit that beats
       hydration must not append the address to the URL. */
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-gb-md">
      <div className="flex flex-col gap-gb-md sm:flex-row">
        <Input
          name="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          aria-label="Enter your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          required
          fieldClassName="flex-1"
        />
        <Button type="submit" size="md" disabled={busy}>
          {status === 'loading' ? 'Please wait...' : status === 'success' ? 'Subscribed' : 'Subscribe'}
        </Button>
      </div>
      {message ? (
        <p
          role="status"
          className={`text-gb-sm ${status === 'error' ? 'text-fg-error' : 'text-fg-tertiary'}`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function NewsClient({
  allGuides,
  topics,
}: {
  allGuides: GeoGuide[];
  topics: string[];
}) {
  const [topic, setTopic] = useState(ALL_TOPICS);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const search = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return allGuides.filter((guide) => {
      if (topic !== ALL_TOPICS && guide.topic !== topic) return false;
      if (!search) return true;
      // Same haystack the old /news searched, so nothing a reader could find
      // before stops being findable now.
      const haystack =
        `${guide.title} ${guide.excerpt} ${guide.topic} ${guide.tags.join(' ')}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [allGuides, topic, search]);

  /*
   * The lead post is the newest match, and it is suppressed while searching:
   * with a query on screen, promoting one of the hits to twice the size of the
   * others implies a relevance ranking that `includes()` does not compute.
   */
  const featured = search ? undefined : filtered[0];
  const rest = featured ? filtered.slice(1) : filtered;

  const totalPages = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  // Clamp rather than reset in an effect: filtering can shrink the list under
  // the current page, and an effect would render one empty frame first.
  const currentPage = Math.min(page, totalPages);
  const visible = rest.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function selectTopic(next: string) {
    setTopic(next);
    setPage(1);
  }

  function updateQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  const isFiltering = search !== '' || topic !== ALL_TOPICS;
  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <MarketingNavigation />

      <main>
        {/* Header band — Figma 153:18279. Grey, and it ends flush under the
            text: the separation from the tabs is the next section's padding. */}
        <section className="bg-surface-muted pt-gb-9xl">
          <Container className="flex flex-col gap-gb-lg">
            <p className="text-gb-md font-semibold text-brand">Blog</p>
            <div className="flex flex-col gap-gb-4xl lg:flex-row lg:items-start">
              <h1 className="flex-1 font-display text-gb-display-sm font-medium tracking-gb-display-tight text-fg lg:max-w-gb-width-xl lg:text-gb-display-lg">
                Resource library
              </h1>
              <div className="flex w-full flex-col gap-gb-xl lg:max-w-gb-width-sm lg:pt-gb-lg">
                <p className="text-gb-xl text-fg-tertiary">
                  Guides on choosing a university, funding it, and getting in — written for
                  Vietnamese students.
                </p>
                <SubscribeRow />
              </div>
            </div>
          </Container>
        </section>

        <section className="py-gb-6xl">
          <Container className="flex flex-col gap-gb-6xl">
            <div className="flex flex-col gap-gb-xl">
              <div className="flex flex-col gap-gb-xl lg:flex-row lg:items-center lg:justify-between">
                {/* Figma 153:18282 "Horizontal tabs". A real tablist: arrow keys
                    are not wired, so these stay buttons in a plain row. */}
                <div className="-mx-gb-md flex min-w-0 flex-1 gap-gb-xs overflow-x-auto px-gb-md pb-gb-xs">
                  {topics.map((name) => {
                    const active = name === topic;
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => selectTopic(name)}
                        aria-pressed={active}
                        className={`flex h-gb-6xl shrink-0 items-center justify-center rounded-gb-sm px-gb-lg text-gb-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                          active
                            ? 'bg-surface-hover text-fg-secondary'
                            : 'text-fg-muted hover:bg-surface-hover'
                        }`}
                      >
                        {name === ALL_TOPICS ? 'View all' : name}
                      </button>
                    );
                  })}
                </div>

                {/* Search — see the SEARCH note in the file header. Undrawn.
                    Same field chrome as the /universities search so the two
                    read as one control, not two takes on the idea. */}
                <label className="relative flex items-center lg:max-w-gb-width-sm lg:flex-1">
                  <span className="pointer-events-none absolute left-gb-input-x text-fg-muted">
                    <SearchMark frame={20} />
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => updateQuery(event.target.value)}
                    placeholder="Search articles, topics or tags"
                    aria-label="Search articles, topics or tags"
                    className="w-full rounded-gb-md border border-line-strong bg-surface py-gb-input-y pl-gb-6xl pr-gb-input-x text-gb-md text-fg shadow-gb-xs placeholder:text-fg-muted focus:outline-2 focus:outline-offset-0 focus:outline-brand"
                  />
                </label>
              </div>

              {/* A count only while a filter is on — with no filter it would
                  just restate the length of the list underneath it. */}
              {isFiltering ? (
                <p role="status" className="text-gb-sm text-fg-muted">
                  <span className="font-semibold text-fg-secondary">{filtered.length}</span>{' '}
                  <span>{filtered.length === 1 ? 'article' : 'articles'}</span>
                </p>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <p className="py-gb-9xl text-center text-gb-md text-fg-tertiary">
                {search ? 'No articles match that search yet.' : 'No posts in this topic yet.'}
              </p>
            ) : (
              <>
                {/* The lead post belongs to the first page of results only. */}
                {featured && currentPage === 1 ? <FeaturedPost guide={featured} /> : null}

                {visible.length > 0 ? (
                  <div className="grid grid-cols-1 gap-x-gb-4xl gap-y-gb-6xl md:grid-cols-2">
                    {visible.map((guide) => (
                      <BlogPostCard key={guide.slug} guide={guide} />
                    ))}
                  </div>
                ) : null}
              </>
            )}

            <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
          </Container>
        </section>
      </main>

      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={FOOTER_TAGLINE}
        columns={FOOTER_COLUMNS}
        social={FOOTER_SOCIAL}
        copyright={FOOTER_COPYRIGHT}
        ratings={FOOTER_RATINGS}
      />
    </div>
  );
}
