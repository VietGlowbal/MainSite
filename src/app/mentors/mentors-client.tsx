'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
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
import type { PublicMentor } from '@/lib/mentors';
import { formatMoney } from '@/lib/currency';
import { StarIcon } from '@/components/mentorship/mentor-icons';
import {
  Badge,
  Button,
  Container,
  Footer,
  ICONS,
  Input,
  KitIcon,
  Pagination,
  Select,
  VerifiedMark,
} from '@/shared/ui';

const subscribeToUrl = () => () => {};
const getServerUniversityId = () => undefined;
const getUniversityIdFromUrl = () => {
  const value = Number(new URLSearchParams(window.location.search).get('university'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * /mentors — "Tìm cố vấn", Figma 154:8345 on the "Tính năng" canvas.
 *
 * ⚠️ PROVENANCE. This frame is on "Tính năng", not "UI Final - Dev". The
 * designer is migrating flows between the two, and migration has meant redraw:
 * the saved list was built from 223:8824 and its migrated twin (337:18493)
 * arrived taller with two dialogs that did not exist before. Expect this page to
 * need a pass when 154:8345 migrates. Built now at the owner's explicit request,
 * with that risk stated.
 *
 * Where this departs from the frame, and why:
 *
 *  1. THE FOOTER IN THE FRAME IS NOT OURS. 154:8345 still carries the stock
 *     Untitled UI footer — "Untitled UI", "Design amazing digital experiences
 *     for more happy in the world", Product/Company/Resources/Social/Legal, and
 *     "© 2077 Untitled UI. All rights reserved." It is kit boilerplate the
 *     designer has not replaced. The real Footer is used instead.
 *
 *  2. THE SUPPORTING LINE IS REWRITTEN. The frame reads "Explore 10,000+
 *     universities worldwide and find your perfect fit." — the university search
 *     subtitle, left behind when this screen was duplicated from it. Same
 *     leftover as on the applications list.
 *
 *  3. THE SIX "CHỌN THEO TIÊU CHÍ" CHIPS ARE DROPPED. They read "Xếp hạng QS thế
 *     giới", "Học Bổng", "Tỷ lệ trúng tuyển", "Bậc Học", "Khung cảnh khuôn viên",
 *     "Ngôn ngữ chương trình" — QS rank, scholarships, acceptance rate, campus
 *     setting. Those are filters for choosing a *university*, and mean nothing
 *     against a mentor. The controls kept are the ones that map to real mentor
 *     columns: name/university search, country, and subject.
 *
 *  4. THE ROSTER IS REAL. Every card in the frame says "Khánh Linh / Founder &
 *     CEO" over a stock portrait. The real mentors come from achiever_profiles;
 *     the rose sub-line under each name is their course, which is the fact a
 *     student is choosing on.
 *
 *  5. NO MOBILE FRAME EXISTS — the only 375-wide frames in the file are the
 *     three nav menus. The grid steps 1 / 2 / 4 across.
 */

const PAGE_SIZE = 8;

const DEGREE_LABELS: Record<PublicMentor['degree_level'], string> = {
  undergraduate: 'Undergraduate',
  masters: "Master's",
  phd: 'PhD',
  alumni: 'Alumni',
};

function UniversityLogo({
  logoUrl,
  universityName,
}: {
  logoUrl?: string | null;
  universityName: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = universityName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <span
      className="relative flex size-[56px] shrink-0 items-center justify-center overflow-hidden rounded-gb-full border-2 border-white bg-surface p-gb-sm text-gb-lg font-semibold text-fg-secondary shadow-gb-md ring-1 ring-line"
      aria-hidden="true"
    >
      {logoUrl && !imageFailed ? (
        <Image
          src={logoUrl}
          alt=""
          fill
          sizes="56px"
          className="object-contain p-gb-sm"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}

function MentorCard({ mentor, preload }: { mentor: PublicMentor; preload: boolean }) {
  const universityName = mentor.university?.name ?? 'University not listed';
  const rate = Number(mentor.hourly_rate_amount ?? 0);
  const rateLabel = rate > 0
    ? `${formatMoney(rate, mentor.hourly_rate_currency)}/hour`
    : 'Pricing pending';
  const rating = Number(mentor.avg_rating ?? 0);
  const studyStatus = mentor.currently_enrolled
    ? 'Currently studying'
    : mentor.graduation_year
      ? `Class of ${mentor.graduation_year}`
      : null;

  return (
    <li className="group flex h-full flex-col overflow-hidden rounded-gb-2xl border border-line bg-surface shadow-gb-xs transition duration-200 hover:-translate-y-gb-xxs hover:border-gb-brand-300 hover:shadow-gb-lg">
      <div className="relative">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-muted">
          {mentor.avatar_url ? (
            <Image
              src={mentor.avatar_url}
              alt={mentor.display_name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
              preload={preload}
              className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-gb-display-sm font-semibold text-fg-muted">
              {mentor.display_name.trim().charAt(0).toUpperCase() || '?'}
            </div>
          )}

          {studyStatus ? (
            <Badge
              variant={mentor.currently_enrolled ? 'safe-chip' : 'neutral-chip'}
              className="absolute left-gb-xl top-gb-xl shadow-gb-xs"
            >
              {studyStatus}
            </Badge>
          ) : null}
        </div>

        {mentor.university ? (
          <span className="absolute -bottom-gb-3xl right-gb-2xl">
            <UniversityLogo
              logoUrl={mentor.university.logo_url}
              universityName={mentor.university.name}
            />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-gb-2xl pt-gb-4xl">
        <div className="flex items-start justify-between gap-gb-lg pr-[52px]">
          <h2 className="min-w-0 text-gb-lg font-semibold text-fg">
            {mentor.display_name}
          </h2>
          {mentor.verified_at ? (
            <span className="mt-gb-xs shrink-0 text-fg-verified">
              <VerifiedMark frame={16} />
            </span>
          ) : null}
        </div>

        <div className="mt-gb-sm min-h-[42px]">
          <p className="line-clamp-2 text-gb-sm font-medium text-fg-secondary">
            {universityName}
          </p>
          {mentor.university?.country ? (
            <p className="mt-gb-xxs flex items-center gap-gb-xs text-gb-xs text-fg-muted">
              <KitIcon art={ICONS.markerPin02} frame={16} />
              <span className="truncate">{mentor.university.country}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-gb-xl rounded-gb-xl bg-brand-subtle px-gb-xl py-gb-lg">
          <p className="line-clamp-2 text-gb-sm font-semibold text-fg">
            {mentor.subject || 'Subject not listed'}
          </p>
          <p className="mt-gb-xs flex items-center gap-gb-sm text-gb-xs font-medium text-fg-brand">
            <KitIcon art={ICONS.graduationCap} frame={16} />
            {DEGREE_LABELS[mentor.degree_level]}
          </p>
        </div>

        {mentor.bio ? (
          <p className="mt-gb-xl line-clamp-3 text-gb-sm leading-relaxed text-fg-tertiary">
            {mentor.bio}
          </p>
        ) : (
          <p className="mt-gb-xl text-gb-sm text-fg-muted">
            Open the profile to see this advisor&apos;s experience and support topics.
          </p>
        )}

        <div className="mt-auto pt-gb-2xl">
          <div className="flex items-end justify-between gap-gb-lg border-t border-line pt-gb-xl">
            <div>
              <p className="text-gb-xs font-medium text-fg-muted">Experience</p>
              {mentor.total_sessions > 0 ? (
                <p className="mt-gb-xs flex items-center gap-gb-xs text-gb-sm font-semibold text-fg">
                  <StarIcon size={14} filled />
                  {rating.toFixed(1)}
                  <span className="font-normal text-fg-muted">
                    ({mentor.total_sessions} session{mentor.total_sessions === 1 ? '' : 's'})
                  </span>
                </p>
              ) : (
                <p className="mt-gb-xs text-gb-sm font-semibold text-fg">New advisor</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-gb-xs font-medium text-fg-muted">Session rate</p>
              <p className="mt-gb-xs text-gb-sm font-semibold text-fg">{rateLabel}</p>
            </div>
          </div>

          <Link
            href={`/advisors/${mentor.id}`}
            aria-label={`View ${mentor.display_name}'s profile`}
            className="mt-gb-xl flex min-h-11 w-full items-center justify-center gap-gb-sm rounded-gb-md bg-brand px-gb-xl py-gb-lg text-gb-sm font-semibold text-on-brand shadow-gb-xs transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            View profile
            <KitIcon art={ICONS.arrowRight} frame={20} />
          </Link>
        </div>
      </div>
    </li>
  );
}

export function MentorsClient({ mentors }: { mentors: PublicMentor[] }) {
  const initialUniversityId = useSyncExternalStore(
    subscribeToUrl,
    getUniversityIdFromUrl,
    getServerUniversityId,
  );
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [subject, setSubject] = useState('');
  const [page, setPage] = useState(1);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const m of mentors) if (m.university?.country) set.add(m.university.country);
    return [...set].sort();
  }, [mentors]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const m of mentors) if (m.subject) set.add(m.subject);
    return [...set].sort();
  }, [mentors]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mentors.filter((m) => {
      if (initialUniversityId && m.university_id !== initialUniversityId) return false;
      if (country && m.university?.country !== country) return false;
      if (subject && m.subject !== subject) return false;
      if (q) {
        const haystack = `${m.display_name} ${m.university?.name ?? ''} ${m.subject}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [mentors, search, country, subject, initialUniversityId]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  // A filter change can leave `page` past the end of the new result set.
  const safePage = Math.min(page, totalPages);
  const visible = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const primaryAction = { href: '/advisors/apply', label: 'Become an advisor' };

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <MarketingNavigation primaryAction={primaryAction} />

      <main className="min-h-screen pb-gb-9xl pt-gb-6xl">
        <Container className="flex flex-col gap-gb-6xl">
          {/* Figma 154:8352 */}
          <div className="flex flex-col gap-gb-lg">
            <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg md:text-gb-display-md">
              Find an advisor
            </h1>
            <p className="max-w-gb-width-xl text-gb-xl text-fg-tertiary">
              Talk to a student who has already been admitted where you are applying.
            </p>
          </div>

          {/* Figma 154:8360 — the search row */}
          <div className="flex flex-col gap-gb-lg lg:flex-row lg:items-end">
            <Input
              name="mentor-search"
              label="Search"
              placeholder="Search by name or university"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              fieldClassName="flex-1"
            />
            <Select
              name="mentor-country"
              label="Country"
              placeholder="Anywhere"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPage(1);
              }}
              fieldClassName="lg:w-[220px]"
            >
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              name="mentor-subject"
              label="Subject"
              placeholder="Any subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setPage(1);
              }}
              fieldClassName="lg:w-[220px]"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          {results.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-gb-xl border-b border-line pb-gb-xl">
                <p className="text-gb-sm font-semibold text-fg">
                  {results.length} advisor{results.length === 1 ? '' : 's'}
                </p>
                <p className="hidden text-gb-sm text-fg-muted sm:block">
                  Compare university, academic background, experience and rate.
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-gb-4xl sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((m, index) => (
                  <MentorCard key={m.id} mentor={m} preload={index === 0} />
                ))}
              </ul>
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </>
          ) : (
            <div className="flex flex-col items-start gap-gb-xl rounded-gb-2xl border border-line bg-surface-muted p-gb-5xl">
              <p className="text-gb-md text-fg-tertiary">
                {mentors.length === 0
                  ? 'No advisors have been approved yet. Check back soon.'
                  : 'No advisor matches those filters yet. Try widening the country or subject.'}
              </p>
              <Button href="/advisors/apply" size="lg">
                Become an advisor
              </Button>
            </div>
          )}
        </Container>
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
