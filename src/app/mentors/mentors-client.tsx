'use client';

import { useMemo, useState } from 'react';
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
import type { PublicMentor } from '@/lib/mentors';
import {
  Badge,
  Button,
  Container,
  Footer,
  ICONS,
  Input,
  KitIcon,
  MobileNav,
  Pagination,
  Select,
  TopNav,
} from '@/shared/ui';

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

function MentorCard({ mentor }: { mentor: PublicMentor }) {
  const course = [mentor.degree_level, mentor.subject].filter(Boolean).join(' · ');

  return (
    <li className="flex flex-col gap-gb-xl">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-gb-2xl bg-surface-muted">
        {mentor.avatar_url ? (
          /* Avatars come from user uploads and OAuth providers, so a plain <img>
             rather than next/image — an unconfigured host throws at runtime.
             Same call as the saved list's covers. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mentor.avatar_url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-gb-display-sm font-semibold text-fg-muted">
            {mentor.display_name.trim().charAt(0).toUpperCase() || '?'}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-gb-md">
        <p className="text-gb-md font-semibold text-fg">{mentor.display_name}</p>

        {/* Its own line, not inline with the name: `Badge` bakes in
            whitespace-nowrap, and real university names run to "London School of
            Economics and Political Science", which then overran the next column
            of the grid. Truncated inside the pill instead. */}
        {mentor.university ? (
          <Badge variant="brand-subtle" className="max-w-full self-start">
            <span className="min-w-0 truncate">{mentor.university.name}</span>
          </Badge>
        ) : null}

        {course ? <p className="text-gb-sm font-semibold text-brand">{course}</p> : null}

        {mentor.bio ? (
          <p className="line-clamp-3 text-gb-sm text-fg-tertiary">{mentor.bio}</p>
        ) : null}

        <Link
          href={`/mentors/${mentor.id}`}
          className="flex w-fit items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          View profile
          <KitIcon art={ICONS.arrowUpRight} frame={20} />
        </Link>
      </div>
    </li>
  );
}

export function MentorsClient({
  mentors,
  initialUniversityId,
  userName,
  userAvatarUrl,
}: {
  mentors: PublicMentor[];
  initialUniversityId?: number | undefined;
  userName?: string | null;
  userAvatarUrl?: string | null;
}) {
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

  const isSignedIn = !!userName;
  const primaryAction = { href: '/mentors/apply', label: 'Become a mentor' };

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

      <main className="min-h-screen pb-gb-9xl pt-gb-6xl">
        <Container className="flex flex-col gap-gb-6xl">
          {/* Figma 154:8352 */}
          <div className="flex flex-col gap-gb-lg">
            <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg md:text-gb-display-md">
              Find a mentor
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
              <ul className="grid grid-cols-1 gap-gb-5xl sm:grid-cols-2 lg:grid-cols-4">
                {visible.map((m) => (
                  <MentorCard key={m.id} mentor={m} />
                ))}
              </ul>
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </>
          ) : (
            <div className="flex flex-col items-start gap-gb-xl rounded-gb-2xl border border-line bg-surface-muted p-gb-5xl">
              <p className="text-gb-md text-fg-tertiary">
                {mentors.length === 0
                  ? 'No mentors have been approved yet. Check back soon.'
                  : 'No mentor matches those filters yet. Try widening the country or subject.'}
              </p>
              <Button href="/mentors/apply" size="lg">
                Become a mentor
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
