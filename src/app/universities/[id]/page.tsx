import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { getUniversityQueries } from '@/features/universities/api';
import { officialWebsite, splitList } from '@/features/universities/domain';
import { getServerIdentity } from '@/server/auth/server-identity';
import type { University } from '@/lib/types';
import type { DetailSection } from './detail-nav';
import { SITE_URL } from '@/lib/site-url';
import { buildUniversityJsonLd, serializeJsonLd } from '@/lib/seo/json-ld';
import { buildLocaleAlternates } from '@/lib/seo/alternates';
import { UniversityDetail } from './university-detail';
import { UniversityExtras, extraSectionsFor } from './university-extras';
import { localizePath, type Locale } from '@/lib/i18n/locale';

/**
 * /universities/[id] — Figma 375:10629, one page for all 97 universities.
 *
 * Keyed on the numeric id, not a slug: there is no `slug` column on
 * `universities` (checked 2026-07-28), so a slug route would need a migration
 * and a backfill. `/universities/vinuni` still resolves — see its own file.
 *
 * The route goes through the universities repository rather than building an
 * admin client inline, which is why it is not on ADMIN_CLIENT_DEBT in
 * eslint.config.mjs the way the vinuni page is.
 */

export const revalidate = 43200;

/**
 * `getById`, not `getByIds`. They are not interchangeable: `getByIds` selects
 * UNIVERSITY_LIST_COLUMNS, the subset a card needs, and silently omits the long
 * editorial fields this page is mostly made of — `weaknesses` came back
 * undefined and its section vanished with no error anywhere. `getById` selects
 * everything.
 */
async function loadUniversity(rawId: string): Promise<University | null> {
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id)) return null;
  const university = await getUniversityQueries().getById(id);
  return (university as University | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const university = await loadUniversity((await params).id);
  if (!university) return { title: 'University not found | GlowBal' };

  // `specific_insight` is populated on all 97 rows and is the closest thing the
  // table has to a description; it is editorial prose, so it is trimmed rather
  // than reworded.
  const description =
    university.specific_insight?.slice(0, 155) ??
    `Explore admissions, tuition fees, scholarships, and courses at ${university.name}.`;
  const url = `${SITE_URL}/universities/${university.id}`;
  const title = `${university.name} - Admissions & Scholarships | GlowBal`;

  return {
    title,
    description,
    alternates: buildLocaleAlternates(`/universities/${university.id}`),
    openGraph: {
      title,
      description,
      url,
      images: university.image_url
        ? [{ url: university.image_url, alt: university.name }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: university.image_url ? [university.image_url] : undefined,
    },
  };
}

/** Anchors for the bar at 375:10665, minus the ones with no section behind them. */
function sectionsFor(university: University, locale: Locale): DetailSection[] {
  const vi = locale === 'vi';
  const sections: DetailSection[] = [{ id: 'about', label: vi ? 'Giới thiệu' : 'About' }];
  // The frame's "Các ngành" anchor. It had no target until `strengths` and
  // `best_for` stopped being prose inside two other sections — see
  // university-detail.tsx. Still conditional: an anchor to an unrendered
  // section scrolls nowhere.
  if (splitList(university.strengths).length > 0 || splitList(university.best_for).length > 0) {
    sections.push({ id: 'subjects', label: vi ? 'Ngành học' : 'Subjects' });
  }
  sections.push({ id: 'admissions', label: vi ? 'Tuyển sinh' : 'Admissions' });
  if (university.housing) sections.push({ id: 'location', label: vi ? 'Địa điểm' : 'Location' });
  sections.push({ id: 'costs', label: vi ? 'Chi phí & học bổng' : 'Costs & funding' });
  sections.push({ id: 'careers', label: vi ? 'Cơ hội nghề nghiệp' : 'Careers' });
  sections.push({ id: 'why', label: vi ? 'Vì sao chọn trường này' : 'Why this university' });
  sections.push(...extraSectionsFor(university.id));
  sections.push({ id: 'mentors', label: vi ? 'Trao đổi với sinh viên' : 'Talk to a student' });
  return sections;
}

export default async function UniversityDetailPage({
  params,
  locale = 'en',
}: {
  params: Promise<{ id: string }>;
  locale?: Locale;
}) {
  const university = await loadUniversity((await params).id);
  if (!university) notFound();

  const [{ supabase, identity: user }, scholarshipsByUniversity] = await Promise.all([
    getServerIdentity(),
    getScholarshipQueries().byUniversityIds([university.id]),
  ]);

  /*
   * Initial state for the save heart (Figma 522:8643). Read here rather than in
   * the button so the first paint is already correct — a client-side fetch would
   * render every already-saved university as unsaved for a beat, and the reader
   * would see their own list appear to be wrong.
   *
   * RLS scopes user_universities to the owner, so this is the request-scoped
   * client, not an admin one. `head: true` with an exact count avoids pulling a
   * row back to ask a yes/no question.
   */
  let isSaved = false;
  if (user) {
    const { count } = await supabase
      .from('user_universities')
      .select('university_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('university_id', university.id);
    isSaved = (count ?? 0) > 0;
  }

  const scholarships = (scholarshipsByUniversity.get(university.id) ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    fundingType: s.fundingType,
    eligibility: s.eligibility,
    deadlineLabel: s.deadlineLabel,
    sourceUrl: s.sourceUrl,
  }));

  const userName = user?.name ?? null;

  const officialSite = officialWebsite(university.name);
  const jsonLd = buildUniversityJsonLd({
    name: university.name,
    url: `${SITE_URL}${localizePath(`/universities/${university.id}`, locale)}`,
    imageUrl: university.image_url,
    officialWebsite: officialSite,
    description: university.specific_insight ?? null,
    addressCountry: university.country,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <UniversityDetail
        university={university}
        scholarships={scholarships}
        sections={sectionsFor(university, locale)}
        extras={<UniversityExtras universityId={university.id} isSignedIn={!!user} />}
        officialSite={officialSite}
        isSignedIn={!!user}
        isSaved={isSaved}
        userName={userName}
        userAvatarUrl={user?.avatarUrl ?? null}
        locale={locale}
      />
    </>
  );
}
