'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import type { GeoGuide } from '@/lib/geo-content';
import {
  Button,
  Container,
  Footer,
  ICONS,
  Input,
  KitIcon,
  MobileNav,
  Pagination,
  TopNav,
  useLoadingIndicator,
} from '@/shared/ui';

/**
 * /guides — the Blog list, built from Figma 153:18266 ("Blog page header").
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
 *     control, so the copy is a dangling instruction. /guides is also one of
 *     only two places on the site wired to POST /api/newsletter/subscribe, so
 *     shipping the frame literally would delete working functionality to
 *     reproduce placeholder text. The row goes in the column the design's own
 *     copy points at. Ask the designer to draw it (or to drop the sentence).
 *
 * Dropped from the previous version, per the design: the search box, the sort
 * select, and the whole right sidebar (topic list, popular tags, mentor CTA).
 * The sidebar's newsletter form is what survives as (3) above.
 */

/** 2 columns x 3 rows — Figma 153:18283 renders exactly six cards. */
const PAGE_SIZE = 6;

/** listGeoTopics() puts this first; the design labels that tab "View all". */
const ALL_TOPICS = 'All topics';

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Figma "Blog post card" (153:18284).
 *
 * The cover is square-cornered on purpose — the instance has `overflow-clip`
 * with no radius, unlike every other card in the file.
 */
function BlogPostCard({ guide }: { guide: GeoGuide }) {
  const href = `/guides/${guide.slug}`;
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
                <span>{guide.readingTimeMinutes} min read</span>
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
          <h2 className="line-clamp-2 text-gb-lg font-semibold text-fg">
            <Link href={href} className="hover:text-fg-brand">
              {guide.title}
            </Link>
          </h2>
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
        body: JSON.stringify({ email, source: 'guides_page' }),
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

export function GuidesClient({
  allGuides,
  topics,
  userName = null,
  userAvatarUrl = null,
}: {
  allGuides: GeoGuide[];
  topics: string[];
  userName?: string | null;
  userAvatarUrl?: string | null;
}) {
  const [topic, setTopic] = useState(ALL_TOPICS);
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => (topic === ALL_TOPICS ? allGuides : allGuides.filter((guide) => guide.topic === topic)),
    [allGuides, topic],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Clamp rather than reset in an effect: filtering can shrink the list under
  // the current page, and an effect would render one empty frame first.
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function selectTopic(next: string) {
    setTopic(next);
    setPage(1);
  }

  const isSignedIn = !!userName;
  const primaryAction = { href: '/onboarding', label: 'Plan your studies' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        {...(isSignedIn && userName
          ? { user: { name: userName, avatarUrl: userAvatarUrl, href: '/profile' } }
          : { secondaryAction: { href: '/auth', label: 'Sign in' } })}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        secondaryAction={
          isSignedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        openLabel="Menu"
        closeLabel="Close menu"
      />

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
            {/* Figma 153:18282 "Horizontal tabs". A real tablist: arrow keys are
                not wired, so these stay buttons in a plain row. */}
            <div className="-mx-gb-md flex gap-gb-xs overflow-x-auto px-gb-md pb-gb-xs">
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

            {visible.length === 0 ? (
              <p className="py-gb-9xl text-center text-gb-md text-fg-tertiary">
                No posts in this topic yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-x-gb-4xl gap-y-gb-6xl md:grid-cols-2">
                {visible.map((guide) => (
                  <BlogPostCard key={guide.slug} guide={guide} />
                ))}
              </div>
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
