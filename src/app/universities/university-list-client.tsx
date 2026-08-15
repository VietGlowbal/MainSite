'use client';

import Link from 'next/link';
import {
  useCallback,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationSession } from '@/components/navigation-session';
import { useT } from '@/lib/i18n';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Container } from '@/shared/ui/container';
import { Modal } from '@/shared/ui/modal';
import { Pagination } from '@/shared/ui/pagination';
import { SearchMark } from '@/shared/ui/icons';
import { Select } from '@/shared/ui/select';
import { TID, testId } from '@/shared/lib/testids';
import {
  UniversityExplorerProvider,
  useExplorer,
} from '@/features/universities/ui';
import type { ExplorerUniversity } from '@/lib/explorer-utils';
import type { UniversityDirectoryResponse } from '@/features/universities/directory-loader';
import { universitySearchParams } from '@/features/universities/directory-query';
import { useDirectoryNavigation } from '@/shared/hooks/use-directory-navigation';
import { FadeInImage } from './fade-in-image';

/**
 * /universities — rebuilt from Figma 105:8300 ("Page trường").
 *
 * This replaces the 3,227-line globe explorer. The decision (2026-07-25) was to
 * follow the redesign: a flat, server-fed, filterable card grid — no 3D globe,
 * no in-page SPA tabs. What is DELIBERATELY kept:
 *   - explorer-context, verbatim: the login gate and shortlist persistence live
 *     there and are unchanged.
 *   - The lazy image-resolution effect from the old shell.
 *
 * ⚠️ **The in-page detail panel is GONE as of 2026-07-30.** The header above
 * used to record that `DetailView` — the 893-line pre-redesign panel — was kept
 * as "giữ detail cũ tạm" until its redesign landed. That redesign DID land, on
 * 2026-07-28, as the real route /universities/[id] (Figma 375:10629) — but
 * nothing was ever rewired to open it, so clicking a card still swapped in the
 * old panel at `?u=<id>` and the redesigned page was reachable only by typing
 * the URL. The owner reported it on 2026-07-30 as "the detail UI is still the
 * old design", which is exactly what it was. Cards now navigate; the panel and
 * the `?u=` two-way sync are deleted, and `?u=` redirects (see
 * useLegacyDetailParamRedirect).
 *
 * The testid contract in shared/lib/testids.ts still holds: uniResultsGrid,
 * uniCard, uniCardSaveButton, uniSearchInput and uniPagination resolve here.
 * `uniDetailPanel` moved WITH the panel it names — it is now on the root of
 * /universities/[id], so "click a card, expect the detail panel" still passes
 * and now asserts the redesigned page.
 */

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

// Lifted to shared/ui when MultiSelect needed the same glyph — see the note on
// SearchMark. Kept as a local alias so the call sites below read unchanged.
const IconSearch = () => <SearchMark frame={20} />;

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

// ── University card ────────────────────────────────────────────────────────

function UniversityCard({
  uni,
  preloadImage = false,
}: {
  uni: ExplorerUniversity;
  preloadImage?: boolean;
}) {
  const t = useT();
  const {
    isLoggedIn,
    authPending,
    requireLogin,
    isShortlisted,
    addToShortlist,
    removeFromShortlist,
    showToast,
  } = useExplorer();
  const saved = isShortlisted(uni.id);
  const badge = rankingBadgeLabel(uni);

  function toggleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (saved) {
      removeFromShortlist(uni.id);
      showToast(t('Removed from your list'));
    } else {
      addToShortlist(uni.id);
      showToast(t('Saved to your list'));
    }
  }

  return (
    /*
     * The card NAVIGATES to /universities/[id] — the page rebuilt from Figma
     * 375:10629. It used to call `setView('detail')`, which swapped an in-page
     * panel (the pre-redesign DetailView) in at `?u=<id>`, so the whole browse
     * flow never reached the redesigned page and the old design was what
     * everyone actually saw. That panel is gone; this is the rewire.
     *
     * A real <Link> stretched over the card, rather than the old
     * `role="button"` div, so the card gets a URL — middle-click, open in new
     * tab, "copy link" and crawlers all work now. The save button sits above it
     * on the z-axis and keeps its own click; nothing is nested inside the
     * anchor, which would be invalid.
     */
    <div
      {...testId(TID.uniCard)}
      className={`group relative flex flex-col overflow-hidden rounded-gb-xl bg-surface-muted text-left transition-shadow hover:shadow-gb-md focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand ${authPending ? 'pointer-events-none' : ''}`}
    >
      {/* Cover image (226px in the design). Empty until the wiki resolver fills
          it in; the muted card background shows through as the placeholder. */}
      <div className="relative aspect-[386/226] w-full overflow-hidden bg-surface-inverse/5">
        {uni.image_url ? (
          <FadeInImage
            src={uni.image_url}
            alt={uni.name}
            preload={preloadImage}
            className="h-full w-full object-cover"
          />
        ) : null}
        <button
          type="button"
          data-no-auto-translate
          onClick={toggleSave}
          {...testId(TID.uniCardSaveButton)}
          aria-pressed={saved}
          aria-label={t(saved ? 'Remove from your list' : 'Save to your list')}
          className={`absolute right-gb-lg top-gb-lg z-10 flex size-gb-6xl items-center justify-center rounded-gb-full shadow-gb-xs transition-colors ${
            saved ? 'bg-brand text-on-brand' : 'bg-surface/90 text-fg-secondary hover:bg-surface'
          }`}
        >
          <IconHeart filled={saved} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-gb-3xl px-gb-xl pt-gb-3xl pb-gb-3xl">
        <div className="flex flex-col gap-gb-xl">
          <div className="flex flex-col gap-gb-lg">
            <h3 className="text-gb-lg font-semibold text-fg">
              {/*
               * `after:` turns this one anchor into the card's whole hit area.
               * The login gate still comes first for guests: the anchor has a
               * real href so the URL is visible on hover and copyable, and the
               * click is intercepted rather than the link being withheld.
               */}
              <Link
                href={`/universities/${uni.id}`}
                onClick={(e) => {
                  if (!isLoggedIn) {
                    e.preventDefault();
                    requireLogin();
                  }
                }}
                /*
                 * A guest's click is cancelled in favour of the login gate, so
                 * there is no navigation to show a loader for. RouteLoading
                 * listens in the CAPTURE phase — it runs before React's handler,
                 * so `defaultPrevented` is still false by the time it decides —
                 * and its own doc notes that a click which turns out not to
                 * navigate leaves a handle open until SAFETY_MS. That is a flat
                 * 10-second fake loader on the gate. `data-no-loader` is the
                 * opt-out it provides; signed-in users still get the loader,
                 * because they really do navigate.
                 */
                {...(isLoggedIn ? {} : { 'data-no-loader': '' })}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              >
                {uni.name}
              </Link>
            </h3>
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

function DirectoryBrowseView({
  total,
  page,
  pageSize,
  initialSearch,
  initialCountry,
  countries,
  busy,
  error,
  onNavigate,
}: {
  total: number;
  page: number;
  pageSize: number;
  initialSearch: string;
  initialCountry: string;
  countries: string[];
  busy: boolean;
  error: string | null;
  onNavigate: (href: string, replace?: boolean) => void;
}) {
  const { universities } = useExplorer();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initialSearch);
  const [country, setCountry] = useState(initialCountry);

  useEffect(() => {
    const query = name.trim();
    if (query === initialSearch && country === initialCountry) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (country) params.set('country', country);
      const queryString = params.toString();
      onNavigate(queryString ? `/universities?${queryString}` : '/universities', true);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [name, initialSearch, country, initialCountry, onNavigate]);

  function href(nextPage: number) {
    const params = new URLSearchParams();
    const query = name.trim();
    if (query) params.set('q', query);
    if (country) params.set('country', country);
    if (nextPage > 1) params.set('page', String(nextPage));
    const queryString = params.toString();
    return queryString ? `/universities?${queryString}` : '/universities';
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onNavigate(href(1), true);
  }

  function goToPage(nextPage: number) {
    onNavigate(href(nextPage));
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  return (
    <Container
      className="flex flex-col gap-gb-4xl py-gb-6xl"
      aria-busy={busy}
    >
      <div className="flex max-w-gb-width-xl flex-col gap-gb-lg">
        <h1 className="font-display text-gb-display-xs font-semibold md:text-gb-display-sm">
          Find the university that&apos;s right for you
        </h1>
        <p className="text-gb-md text-fg-tertiary md:text-gb-lg">
          Explore universities worldwide and find your perfect fit.
        </p>
        <Link
          href="/universities/matches"
          className="w-fit text-gb-sm font-medium text-fg-brand hover:underline"
        >
          View your university matches
        </Link>
      </div>

      <form className="grid gap-gb-lg md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]" onSubmit={submit}>
        <label className="relative flex items-center">
          <span className="pointer-events-none absolute left-gb-input-x text-fg-muted">
            <IconSearch />
          </span>
          <input
            {...testId(TID.uniSearchInput)}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Search by university name"
            aria-label="Search by university name"
            className="w-full rounded-gb-md border border-line-strong bg-surface py-gb-input-y pl-gb-6xl pr-gb-input-x text-gb-md text-fg shadow-gb-xs placeholder:text-fg-muted focus:outline-2 focus:outline-offset-0 focus:outline-brand"
          />
        </label>
        <Select
          name="country"
          aria-label="Country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        >
          <option value="">All countries</option>
          {countries.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </Select>
        <Button type="submit" size="md">Find universities</Button>
      </form>

      <div ref={resultsRef} className="scroll-mt-gb-9xl">
        {universities.length === 0 ? (
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
            {universities.map((university, index) => (
              <UniversityCard
                key={university.id}
                uni={university}
                preloadImage={index === 0}
              />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div {...testId(TID.uniPagination)}>
          <Pagination page={currentPage} totalPages={totalPages} onPageChange={goToPage} />
        </div>
      ) : null}
      {error ? <p role="alert" className="text-gb-sm text-error-primary">{error}</p> : null}
    </Container>
  );
}

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

// ── Legacy ?u=<id> deep links ───────────────────────────────────────────────

/**
 * Forward `/universities?u=<id>` to `/universities/<id>`.
 *
 * `?u=` used to open the in-page detail panel, and the two-way sync that kept
 * it in step with the URL was the most delicate code on this page. The panel is
 * gone, but the query string is still out there: /api/home/save-university has
 * always finished the sign-up funnel on it, and selection-cache restores a
 * focused university with it. Redirecting keeps every one of those links
 * landing on a real university page instead of silently dropping them on the
 * unfiltered list.
 *
 * `replace`, not `push`, so Back goes to wherever the reader came from rather
 * than to a URL that immediately redirects again.
 */
function useLegacyDetailParamRedirect() {
  const router = useRouter();

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('u');
    if (!param) return;
    const id = Number.parseInt(param, 10);
    if (!Number.isFinite(id)) return;
    router.replace(`/universities/${id}`);
  }, [router]);
}

// ── Page chrome + view switch ────────────────────────────────────────────────

function Chrome({
  total,
  page,
  pageSize,
  search,
  country,
  countries,
  busy,
  error,
  onNavigate,
}: {
  total: number;
  page: number;
  pageSize: number;
  search: string;
  country: string;
  countries: string[];
  busy: boolean;
  error: string | null;
  onNavigate: (href: string, replace?: boolean) => void;
}) {
  useLegacyDetailParamRedirect();

  return (
    <>
      <main className="min-h-screen">
        <DirectoryBrowseView
          key={`${search}\u0000${country}`}
          total={total}
          page={page}
          pageSize={pageSize}
          initialSearch={search}
          initialCountry={country}
          countries={countries}
          busy={busy}
          error={error}
          onNavigate={onNavigate}
        />
      </main>

      <LoginGateModal />
      <Toast />
    </>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

interface Props {
  universities: ExplorerUniversity[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  country: string;
  countries: string[];
  wikiPairs?: Array<[string, string]>;
  canonicalSearch: string;
}

function universityPrefetchHrefs(data: UniversityDirectoryResponse) {
  if (!data.page.hasMore) return [];
  const params = universitySearchParams(data.query, { page: data.page.page + 1 });
  return [`/universities?${params}`];
}

export function UniversityListClient({
  universities,
  total,
  page,
  pageSize,
  search,
  country,
  countries,
  wikiPairs = [],
  canonicalSearch,
}: Props) {
  const navigationSession = useNavigationSession();
  const initialDirectory = useMemo<UniversityDirectoryResponse>(() => ({
    query: { search, country, page },
    page: { items: universities, total, page, pageSize, hasMore: page * pageSize < total },
    wikiPairs,
    canonicalSearch,
  }), [canonicalSearch, country, page, pageSize, search, total, universities, wikiPairs]);
  const getPrefetchHrefs = useCallback(universityPrefetchHrefs, []);
  const directory = useDirectoryNavigation({
    pathname: '/universities',
    endpoint: '/api/directory/universities',
    initialData: initialDirectory,
    getPrefetchHrefs,
  });
  const [withImages, setWithImages] = useState<ExplorerUniversity[]>(directory.data.page.items);
  const [authState, setAuthState] = useState<{
    id: string;
    shortlist: number[];
  } | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    setWithImages(directory.data.page.items);
  }, [directory.data.page.items]);

  useEffect(() => {
    let active = true;
    const userId = navigationSession.user?.id ?? null;

    if (!navigationSession.signedIn || !userId) {
      setAuthState(null);
      setAuthResolved(navigationSession.ready);
      return () => {
        active = false;
      };
    }

    const authenticatedUserId = userId;
    setAuthResolved(false);

    async function hydrate() {
      const { createClient } = await import('@/lib/supabase/client');
      if (!active) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('user_universities')
        .select('university_id')
        .eq('user_id', authenticatedUserId);
      if (!active) return;
      setAuthState({
        id: authenticatedUserId,
        shortlist: (data ?? []).map((row) => row.university_id as number),
      });
      setAuthResolved(true);
    }

    const run = () => void hydrate().catch(() => active && setAuthResolved(true));
    const idleId = window.requestIdleCallback?.(run, { timeout: 1000 }) ?? null;
    const timeoutId = idleId === null ? window.setTimeout(run, 0) : null;
    return () => {
      active = false;
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [navigationSession.ready, navigationSession.signedIn, navigationSession.user?.id]);

  /*
   * Hydration gate for the imagery patch below.
   *
   * The patch replaces the university array that the card subtree renders from,
   * and that subtree can still be hydrating when this component's own effects
   * have already run — so
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
    if (directory.data.wikiPairs.length === 0) return;
    let cancelled = false;
    const ac = new AbortController();
    let frame = 0;

    const run = () => {
      frame = 0;
      fetch('/api/university-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(directory.data.wikiPairs),
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
  }, [directory.data.wikiPairs]);

  return (
    <UniversityExplorerProvider
      initialUniversities={withImages}
      initialShortlist={authState?.shortlist ?? []}
      initialApplications={[]}
      isLoggedIn={authState !== null}
      authPending={!authResolved}
      hasProfile={false}
      admissionUnlocked={false}
      profileStrength={null}
    >
      <Chrome
        total={directory.data.page.total}
        page={directory.data.page.page}
        pageSize={directory.data.page.pageSize}
        search={directory.data.query.search}
        country={directory.data.query.country}
        countries={countries}
        busy={directory.busy}
        error={directory.error}
        onNavigate={directory.navigate}
      />
    </UniversityExplorerProvider>
  );
}
