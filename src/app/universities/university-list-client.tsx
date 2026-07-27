'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Suspense,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  MARKETING_NAV_ITEMS,
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
} from '@/features/marketing/ui';
import {
  Badge,
  Button,
  Container,
  Footer,
  MobileNav,
  Modal,
  Pagination,
  Select,
  TopNav,
} from '@/shared/ui';
import { TID, testId } from '@/shared/lib';
import {
  UniversityExplorerProvider,
  useExplorer,
  type ApplicationEntry,
  type ExplorerUniversity,
} from '@/features/universities/ui';
import { FadeInImage } from './fade-in-image';

/**
 * /universities — rebuilt from Figma 105:8300 ("Page trường").
 *
 * This replaces the 3,227-line globe explorer. The decision (2026-07-25) was to
 * follow the redesign: a flat, server-fed, filterable card grid — no 3D globe,
 * no in-page SPA tabs. What is DELIBERATELY kept, because the e2e contract and
 * the product depend on it:
 *   - explorer-context, verbatim: the login gate, shortlist persistence, and
 *     the detail view state all live there and are unchanged.
 *   - DetailView, the existing 911-line detail panel, shown when a signed-in
 *     user opens a card. Its redesign (Figma 105:8659) is a later pass; this is
 *     the "giữ detail cũ tạm" the owner agreed to.
 *   - The lazy image-resolution effect and the ?u= URL sync from the old shell.
 *
 * The testid contract in shared/lib/testids.ts is the thing that outlives the
 * rewrite: uniResultsGrid, uniCard, uniCardSaveButton, uniSearchInput,
 * uniPagination, uniDetailPanel all still resolve to exactly one element each.
 */

const DetailView = dynamic(() =>
  import('./detail-view').then((mod) => ({ default: mod.DetailView })),
);

const PAGE_SIZE = 9; // 3x3, matching the design.
const AUTH_REDIRECT = '/auth?redirect=/universities';

// ── Card data helpers ─────────────────────────────────────────────────────

/** The rose ranking badge on the card (Figma I105:8403), or null when unranked. */
function rankingBadgeLabel(uni: ExplorerUniversity): string | null {
  if (uni.qs_rank != null && uni.qs_rank <= 50) return 'Global top 50';
  if (uni.qs_rank != null && uni.qs_rank <= 200) return 'Top 200 worldwide';
  if (uni.tags.includes('Global Top 50')) return 'Global top 50';
  if (uni.tags.includes('Top 200')) return 'Top 200 worldwide';
  return null;
}

/** A metric value, or an em dash when the datum is missing — never invented. */
function metric(value: string | number | null | undefined): string {
  if (value == null) return '—';
  const s = String(value).trim();
  return s === '' ? '—' : s;
}

// ── Icons used inline (search field affordances, heart) ────────────────────

function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

// ── University card ────────────────────────────────────────────────────────

function UniversityCard({ uni }: { uni: ExplorerUniversity }) {
  const { setView, isShortlisted, addToShortlist, removeFromShortlist, showToast } = useExplorer();
  const saved = isShortlisted(uni.id);
  const badge = rankingBadgeLabel(uni);

  function open() {
    setView('detail', uni.id);
  }

  function toggleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (saved) {
      removeFromShortlist(uni.id);
      showToast('Removed from your list');
    } else {
      addToShortlist(uni.id);
      showToast('Saved to your list');
    }
  }

  return (
    <div
      {...testId(TID.uniCard)}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-gb-xl bg-surface-muted text-left transition-shadow hover:shadow-gb-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/* Cover image (226px in the design). Empty until the wiki resolver fills
          it in; the muted card background shows through as the placeholder. */}
      <div className="relative aspect-[386/226] w-full overflow-hidden bg-surface-inverse/5">
        {uni.image_url ? (
          <FadeInImage
            src={uni.image_url}
            alt={uni.name}
            className="h-full w-full object-cover"
          />
        ) : null}
        <button
          type="button"
          onClick={toggleSave}
          {...testId(TID.uniCardSaveButton)}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from your list' : 'Save to your list'}
          className={`absolute right-gb-lg top-gb-lg flex size-gb-6xl items-center justify-center rounded-gb-full shadow-gb-xs transition-colors ${
            saved ? 'bg-brand text-on-brand' : 'bg-surface/90 text-fg-secondary hover:bg-surface'
          }`}
        >
          <IconHeart filled={saved} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-gb-3xl px-gb-xl pt-gb-3xl pb-gb-3xl">
        <div className="flex flex-col gap-gb-xl">
          <div className="flex flex-col gap-gb-lg">
            <h3 className="text-gb-lg font-semibold text-fg">{uni.name}</h3>
            {uni.description ? (
              <p className="line-clamp-3 text-gb-md text-fg-tertiary">{uni.description}</p>
            ) : null}
          </div>
          {badge ? <Badge variant="brand-subtle">{badge}</Badge> : null}
        </div>

        {/* Metric rows: label left, value right. The values are free-text from
            the dataset ("15-20% overall; Medicine more competitive"), so the
            value column is allowed to wrap and stays right-aligned. */}
        <dl className="flex flex-col gap-gb-lg">
          <div className="flex items-start justify-between gap-gb-xl">
            <dt className="shrink-0 text-gb-lg text-fg-tertiary">QS ranking</dt>
            <dd className="text-right text-gb-lg font-semibold text-fg">{metric(uni.qs_rank)}</dd>
          </div>
          <div className="flex items-start justify-between gap-gb-xl">
            <dt className="shrink-0 text-gb-lg text-fg-tertiary">Acceptance rate</dt>
            <dd className="text-right text-gb-lg font-semibold text-fg">{metric(uni.accept_rate)}</dd>
          </div>
          <div className="flex items-start justify-between gap-gb-xl">
            <dt className="shrink-0 text-gb-lg text-fg-tertiary">International tuition</dt>
            <dd className="text-right text-gb-lg font-semibold text-fg">{metric(uni.tuition_usd)}</dd>
          </div>
        </dl>

        <Button
          variant="primary-on-dark"
          className="mt-auto w-full"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          View profile
        </Button>
      </div>
    </div>
  );
}

// ── Filters + sort ──────────────────────────────────────────────────────────

type SortKey = 'popular' | 'price-asc' | 'price-desc';

/** Criteria chips that map to data we actually have. See the note in page copy. */
type Criterion = 'ranked' | 'scholarships' | 'acceptance';

const CRITERIA: { key: Criterion; label: string }[] = [
  { key: 'ranked', label: 'World QS ranking' },
  { key: 'scholarships', label: 'Scholarships' },
  { key: 'acceptance', label: 'Acceptance rate' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'price-asc', label: 'Price: low to high' },
];

/** First integer in a tuition string ("$52,000/year" -> 52000), or null. */
function tuitionValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  return digits === '' ? null : Number(digits);
}

const MAJORS: { value: string; label: string; tag: string }[] = [
  { value: 'stem', label: 'Engineering & Technology', tag: 'STEM' },
  { value: 'business', label: 'Business', tag: 'Business' },
  { value: 'arts', label: 'Arts & Humanities', tag: 'Arts' },
  { value: 'medicine', label: 'Medicine & Health', tag: 'Medicine' },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-gb-md border px-gb-lg py-gb-md text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        active
          ? 'border-brand bg-brand-subtle text-fg-brand'
          : 'border-line-strong bg-surface text-fg-secondary hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  );
}

// ── Browse view (the whole redesigned list) ─────────────────────────────────

function BrowseView() {
  const { universities } = useExplorer();
  const resultsRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [major, setMajor] = useState('');
  const [criteria, setCriteria] = useState<Set<Criterion>>(new Set());
  const [sort, setSort] = useState<SortKey>('popular');
  const [page, setPage] = useState(1);

  function toggleCriterion(key: Criterion) {
    setPage(1);
    setCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    const majorTag = MAJORS.find((m) => m.value === major)?.tag;

    const list = universities.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !(u.local_name ?? '').toLowerCase().includes(q)) {
        return false;
      }
      if (loc && !u.country.toLowerCase().includes(loc)) return false;
      if (majorTag && !u.tags.includes(majorTag)) return false;
      if (criteria.has('ranked') && u.qs_rank == null) return false;
      if (criteria.has('scholarships') && u.scholarships.length === 0) return false;
      if (criteria.has('acceptance') && !u.accept_rate) return false;
      return true;
    });

    if (sort === 'popular') return list; // server already ordered by match/rank
    const dir = sort === 'price-asc' ? 1 : -1;
    // Universities with no tuition datum sort to the end regardless of direction.
    return [...list].sort((a, b) => {
      const av = tuitionValue(a.tuition_usd);
      const bv = tuitionValue(b.tuition_usd);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [universities, name, location, major, criteria, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function goToPage(p: number) {
    setPage(p);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <Container className="flex flex-col gap-gb-4xl py-gb-6xl">
        {/* Hero */}
        <div className="flex max-w-gb-width-xl flex-col gap-gb-lg">
          <h1 className="font-display text-gb-display-xs font-semibold md:text-gb-display-sm">
            Find the university that&apos;s right for you
          </h1>
          <p className="text-gb-md text-fg-tertiary md:text-gb-lg">
            Explore universities worldwide and find your perfect fit.
          </p>
        </div>

        {/* Search row */}
        <form
          className="grid gap-gb-lg md:grid-cols-[1fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <label className="relative flex items-center">
            <span className="pointer-events-none absolute left-gb-input-x text-fg-muted">
              <IconSearch />
            </span>
            <input
              {...testId(TID.uniSearchInput)}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage(1);
              }}
              placeholder="Search by university name"
              aria-label="Search by university name"
              className="w-full rounded-gb-md border border-line-strong bg-surface py-gb-input-y pl-gb-6xl pr-gb-input-x text-gb-md text-fg shadow-gb-xs placeholder:text-fg-muted focus:outline-2 focus:outline-offset-0 focus:outline-brand"
            />
          </label>
          <label className="relative flex items-center">
            <span className="pointer-events-none absolute left-gb-input-x text-fg-muted">
              <IconPin />
            </span>
            <input
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setPage(1);
              }}
              placeholder="Where do you want to study"
              aria-label="Where do you want to study"
              className="w-full rounded-gb-md border border-line-strong bg-surface py-gb-input-y pl-gb-6xl pr-gb-input-x text-gb-md text-fg shadow-gb-xs placeholder:text-fg-muted focus:outline-2 focus:outline-offset-0 focus:outline-brand"
            />
          </label>
          <Select
            name="major"
            aria-label="Select a major"
            placeholder="Select a major"
            value={major}
            onChange={(e) => {
              setMajor(e.target.value);
              setPage(1);
            }}
          >
            {MAJORS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Button type="submit" size="md">
            Find universities
          </Button>
        </form>

        {/* Criteria chips */}
        <div className="flex flex-col gap-gb-lg">
          <h2 className="text-gb-md font-semibold text-fg">Filter by criteria</h2>
          <div className="flex flex-wrap gap-gb-md">
            {CRITERIA.map((c) => (
              <Chip key={c.key} active={criteria.has(c.key)} onClick={() => toggleCriterion(c.key)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Sort chips */}
        <div className="flex flex-col gap-gb-lg">
          <h2 className="text-gb-md font-semibold text-fg">Sort by</h2>
          <div className="flex flex-wrap gap-gb-md">
            {SORTS.map((s) => (
              <Chip
                key={s.key}
                active={sort === s.key}
                onClick={() => {
                  setSort(s.key);
                  setPage(1);
                }}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="scroll-mt-gb-9xl">
          {pageItems.length === 0 ? (
            <div className="rounded-gb-xl border border-line bg-surface-muted px-gb-3xl py-gb-7xl text-center">
              <p className="text-gb-lg font-semibold text-fg">No universities match your filters</p>
              <p className="mt-gb-sm text-gb-md text-fg-tertiary">
                Try clearing a filter or searching a different name.
              </p>
            </div>
          ) : (
            <div
              {...testId(TID.uniResultsGrid)}
              className="grid grid-cols-1 gap-gb-4xl sm:grid-cols-2 lg:grid-cols-3"
            >
              {pageItems.map((uni) => (
                <UniversityCard key={uni.id} uni={uni} />
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <div {...testId(TID.uniPagination)}>
            <Pagination page={current} totalPages={totalPages} onPageChange={goToPage} />
          </div>
        ) : null}
      </Container>
  );
}

// ── Login gate (guest funnel) ───────────────────────────────────────────────

function LoginGateModal() {
  const { loginGateOpen, closeLoginGate } = useExplorer();
  const router = useRouter();
  return (
    <Modal
      open={loginGateOpen}
      onClose={closeLoginGate}
      label="Log in to continue"
      className="max-w-gb-width-sm p-gb-5xl text-center"
    >
      <h2 className="text-gb-xl font-semibold text-fg">Log in to keep exploring</h2>
      <p className="mt-gb-md text-gb-sm text-fg-tertiary">
        Create a free account to open full university profiles, discover scholarships and unlock
        your personalised matches.
      </p>
      <div className="mt-gb-3xl flex flex-col items-center gap-gb-md">
        <Button onClick={() => router.push(AUTH_REDIRECT)} size="xl" className="w-full">
          Log in or sign up
        </Button>
        <button
          type="button"
          onClick={closeLoginGate}
          className="rounded-gb-md px-gb-md py-gb-sm text-gb-sm font-medium text-fg-muted transition-colors hover:text-fg-secondary"
        >
          Maybe later
        </button>
      </div>
    </Modal>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast() {
  const { toast } = useExplorer();
  if (!toast?.visible) return null;
  return (
    <div
      {...testId(TID.toast)}
      role="status"
      className="fixed bottom-gb-4xl left-1/2 z-50 -translate-x-1/2 rounded-gb-md bg-surface-inverse-strong px-gb-xl py-gb-lg text-gb-sm font-medium text-white shadow-gb-lg"
    >
      {toast.message}
    </div>
  );
}

// ── URL sync (?u=<id> <-> detail view), unchanged from the old shell ─────────

function useUniversityUrlSync() {
  const { activeView, selectedUniversityId, universities, setView } = useExplorer();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const lastWrittenRef = useRef<string>('');

  useEffect(() => {
    const param = searchParams.get('u');
    if (param) {
      const id = parseInt(param, 10);
      if (Number.isFinite(id) && universities.some((u) => u.id === id)) {
        if (activeView !== 'detail' || selectedUniversityId !== id) {
          setView('detail', id);
        }
      }
    } else if (activeView === 'detail') {
      /*
       * No `?u` in the URL while the detail view is open normally means the user
       * pressed Back, so the view closes. But it ALSO describes the moment right
       * after a card is clicked: the effect below has asked the router for
       * `?u=<id>` and `searchParams` has not caught up yet. Closing the view
       * there reverts the click — the card opens and instantly snaps shut, and
       * because the effect below then rewrites the URL to '', it never recovers.
       *
       * `lastWrittenRef` is the discriminator: non-empty means the pending
       * write is ours, so this is our own navigation in flight, not a Back.
       * (Guests never hit this — setView bounces them to the login gate before
       * the view changes, which is why only signed-in users saw it.)
       */
      if (lastWrittenRef.current !== '') return;
      setView('browse');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, universities]);

  useEffect(() => {
    const desired =
      activeView === 'detail' && selectedUniversityId != null
        ? `?u=${selectedUniversityId}`
        : '';
    if (desired === lastWrittenRef.current) return;
    lastWrittenRef.current = desired;
    router.replace(`${pathname}${desired}`, { scroll: false });
  }, [activeView, selectedUniversityId, pathname, router]);
}

// ── Page chrome + view switch ────────────────────────────────────────────────

function Chrome({
  userName,
  userAvatarUrl,
  isLoggedIn,
}: {
  userName: string | null;
  userAvatarUrl: string | null;
  isLoggedIn: boolean;
}) {
  const { activeView } = useExplorer();
  useUniversityUrlSync();

  const primaryAction = { href: '/onboarding', label: 'Plan your studies' };

  return (
    /* gb-has-mobile-header: this full-bleed page ships its own MobileNav (a
       fixed header), so globals.css must keep the mobile top offset that plain
       full-bleed pages drop. */
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        {...(isLoggedIn && userName
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
          isLoggedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        openLabel="Menu"
        closeLabel="Close menu"
      />

      <main className="min-h-screen">
        {activeView === 'detail' ? (
          <div {...testId(TID.uniDetailPanel)}>
            <DetailView />
          </div>
        ) : (
          <BrowseView />
        )}
      </main>

      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={FOOTER_TAGLINE}
        columns={FOOTER_COLUMNS}
        social={FOOTER_SOCIAL}
        copyright={FOOTER_COPYRIGHT}
        ratings={FOOTER_RATINGS}
      />

      <LoginGateModal />
      <Toast />
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

interface Props {
  universities: ExplorerUniversity[];
  initialShortlist: number[];
  initialApplications: ApplicationEntry[];
  isLoggedIn: boolean;
  hasProfile: boolean;
  admissionUnlocked: boolean;
  profileStrength: number | null;
  userName: string | null;
  userAvatarUrl: string | null;
  wikiPairs?: Array<[string, string]>;
}

export function UniversityListClient({
  universities,
  initialShortlist,
  initialApplications,
  isLoggedIn,
  hasProfile,
  admissionUnlocked,
  profileStrength,
  userName,
  userAvatarUrl,
  wikiPairs = [],
}: Props) {
  const [withImages, setWithImages] = useState<ExplorerUniversity[]>(universities);

  /*
   * Hydration gate for the imagery patch below.
   *
   * The patch replaces the university array that the card subtree renders from,
   * and that subtree sits inside the <Suspense> boundary at the bottom of this
   * component (it has to: Chrome reads useSearchParams). A Suspense child can
   * still be hydrating when this component's own effects have already run — so
   * swapping its data straight from an effect races hydration, and React reports
   * a mismatch, throws away the server HTML, and re-renders the whole tree on
   * the client. The symptom is not subtle: the cards that were still awaiting
   * imagery are exactly the ones that differ, and after the discard the explorer
   * comes up with default state, which is why a signed-in user's click on a card
   * could land on the login gate instead of the detail view.
   *
   * Two things keep the patch out of hydration's way. The load of it is
   * `startTransition`: React treats a transition update as interruptible and
   * processes it after hydration rather than tearing into it. The rAF defer on
   * top only makes it unlikely the response even arrives mid-hydration, which
   * matters because the endpoint answers in single-digit milliseconds once its
   * cache is warm — that is why this surfaced after repeated runs and not on a
   * cold first visit.
   */

  // Lazy imagery hydration — the server ships the page with no external images
  // so the response is instant; one batch request to /api/university-images then
  // patches campus + logo URLs in place.
  useEffect(() => {
    if (wikiPairs.length === 0) return;
    let cancelled = false;
    const ac = new AbortController();
    let frame = 0;

    const run = () => {
      frame = 0;
      fetch('/api/university-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wikiPairs),
        signal: ac.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((imagery: Record<string, { campus: string | null; logo: string | null }> | null) => {
          if (cancelled || !imagery) return;
          startTransition(() => {
            setWithImages((prev) =>
              prev.map((uni) => {
                const cleanName = uni.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
                const title = cleanName.replace(/\s+/g, '_');
                const resolved = imagery[title];
                if (!resolved) return uni;
                return {
                  ...uni,
                  image_url: resolved.campus ?? uni.image_url,
                  logo_url: resolved.logo ?? uni.logo_url,
                };
              }),
            );
          });
        })
        .catch(() => {
          /* keep placeholders */
        });
    };

    frame = requestAnimationFrame(run);

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      ac.abort();
    };
  }, [wikiPairs]);

  return (
    <UniversityExplorerProvider
      initialUniversities={withImages}
      initialShortlist={initialShortlist}
      initialApplications={initialApplications}
      isLoggedIn={isLoggedIn}
      hasProfile={hasProfile}
      admissionUnlocked={admissionUnlocked}
      profileStrength={profileStrength}
    >
      <Suspense fallback={null}>
        <Chrome userName={userName} userAvatarUrl={userAvatarUrl} isLoggedIn={isLoggedIn} />
      </Suspense>
    </UniversityExplorerProvider>
  );
}
