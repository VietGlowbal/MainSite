import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { getUniversityQueries } from '@/features/universities/api';
import { formatTuitionForCard, officialWebsite } from '@/features/universities/domain';
import { createClient } from '@/lib/supabase/server';
import { SavedListClient, type SavedRow, type ScholarshipOption } from './saved-list-client';

/**
 * /my-universities — "Danh sách đã lưu", the saved list.
 *
 * Figma 375:12701 on the authoritative "Khanh Linh - Chi" canvas, with 375:12841
 * as the scholarship-attached state. ⚠️ This page was first built from 223:8824
 * / 223:13621 on the RETIRED "Tính năng" canvas, which draws a strictly smaller
 * card: no tuition, no chosen subject, no re-pick link. See
 * docs/redesign-status.md — the two canvases diverge and the newer one wins.
 *
 * This route used to be a bare `redirect('/apply')`, which left a sitemap-level
 * destination (Figma 123:2864 lists "Lưu" as one of ten) with no page — and
 * since src/proxy.ts sends every fresh sign-in here, it also meant the
 * post-login landing was a bounce. The 928-line my-universities-client.tsx it
 * used to render had already been orphaned by that redirect; it is not revived
 * here, because the design is a different page.
 *
 * /apply keeps its own job: the sitemap calls that one "Study abroad plan" and
 * its design is the "My application" pair (224:14068, 224:14957) — a progress
 * dashboard, not a saved list.
 *
 * Auth: src/proxy.ts already gates this path (PROTECTED_ROUTES plus the
 * onboarding gate), so arriving here signed-out should be impossible. The
 * redirect below is a belt-and-braces guard, not the primary gate.
 */

export const metadata: Metadata = {
  title: 'Saved universities | GlowBal',
  description:
    'The universities you have saved, with their deadlines and the scholarships attached to them.',
};

export default async function MyUniversitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=%2Fmy-universities');

  /*
   * `select('*')` rather than a column list, and that is deliberate.
   *
   * `program` / `program_url` (supabase-saved-program.sql) back the "Ngành …"
   * line and the re-pick link. Naming them explicitly would make this read fail
   * outright — with the whole saved list, not just the subject — on any project
   * where that file has not been run yet. A star select returns whatever the
   * table actually has, and the two fields are then read as optional below. The
   * table is eight narrow columns, so there is nothing to save by listing them.
   */
  const { data: savedRows, error: savedError } = await supabase
    .from('user_universities')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });

  /*
   * A failed read and an empty list render identically — an empty saved list —
   * so the error has to be logged or the page lies about the student having
   * saved nothing. This is not hypothetical: `public.user_universities` is
   * absent from at least one project this runs against (supabase-schema.sql:151
   * creates it), and every save across the app silently no-ops there. Logging
   * mirrors what the feature repositories already do.
   */
  if (savedError) {
    console.error('my-universities: reading user_universities failed:', savedError.message);
  }

  const saved = (savedRows ?? []) as Array<{
    id: number;
    university_id: number;
    added_at: string | null;
    /** Absent until supabase-saved-program.sql has been applied. */
    program?: string | null;
    program_url?: string | null;
  }>;
  const universityIds = saved.map((row) => row.university_id);

  /*
   * Three reads, one round trip each:
   *   - the universities themselves, hydrated from the saved ids
   *   - the scholarships the user has already attached to them
   *     (user_scholarships.university_id is what makes that link possible)
   *   - every scholarship linked to those universities, which is what the
   *     "Apply scholarship" picker chooses from
   */
  const [universities, savedScholarshipRows, linkedScholarships] = await Promise.all([
    getUniversityQueries().getByIds(universityIds),
    universityIds.length > 0
      ? supabase
          .from('user_scholarships')
          .select('id, scholarship_id, university_id')
          .eq('user_id', user.id)
          .in('university_id', universityIds)
      : Promise.resolve({ data: [] }),
    getScholarshipQueries().byUniversityIds(universityIds),
  ]);

  const savedScholarships = (savedScholarshipRows.data ?? []) as Array<{
    id: number;
    scholarship_id: number;
    university_id: number | null;
  }>;
  const labels = await getScholarshipQueries().byIds(
    savedScholarships.map((row) => row.scholarship_id),
  );

  const byId = new Map(universities.map((uni) => [uni.id, uni]));

  // getByIds returns rows in whatever order the database hands back, so the
  // saved order (newest first) is reapplied here rather than lost.
  const rows: SavedRow[] = saved.flatMap((row) => {
    const uni = byId.get(row.university_id);
    if (!uni) return [];

    const attached = savedScholarships
      .filter((s) => s.university_id === row.university_id)
      .flatMap((s) => {
        const label = labels.get(s.scholarship_id);
        return label
          ? [{ savedId: s.id, id: label.id, name: label.name, amountLabel: label.amountLabel }]
          : [];
      });

    const options: ScholarshipOption[] = (linkedScholarships.get(row.university_id) ?? []).map(
      (s) => ({
        id: s.id,
        name: s.name,
        amountLabel: s.amountLabel,
        deadlineLabel: s.deadlineLabel,
        coverage: s.coverage,
        /* What the discount maths reads — `bestCoveragePercent` on the bar and
           `computeNetTuition` on the row. Carried on the option rather than on
           `attached`, because `byIds` (which builds `attached`) has no coverage
           in its projection and the same awards appear on both sides. */
        fundingType: s.fundingType,
        amountMin: s.amountMin,
        amountMax: s.amountMax,
        amountCurrency: s.amountCurrency,
        // The detail panel's fields — Figma 375:13369.
        scope: s.scope,
        eligibility: s.eligibility,
        conditions: s.conditions,
        insight: s.insight,
        appliesToText: s.appliesToText,
        sourceUrl: s.sourceUrl,
      }),
    );

    return [
      {
        id: row.id,
        universityId: row.university_id,
        name: uni.name,
        country: uni.country,
        type: uni.type ?? null,
        qsRank: uni.qs_rank ?? null,
        theRank: uni.the_rank ?? null,
        deadline: uni.application_deadline ?? null,
        summary: uni.best_for ?? uni.strengths ?? null,
        imageUrl: uni.image_url ?? null,
        logoUrl: uni.logo_url ?? null,
        website: officialWebsite(uni.name),
        /* The frame's rose badge (375:12740). `tuition_usd` is editorial prose,
           not a number — "32,000–44,000 (intl UG, Medicine higher)" — so it goes
           through the same formatter the university cards use, and the full
           string stays reachable as a title attribute. */
        tuition: formatTuitionForCard(uni.tuition_usd),
        tuitionRaw: uni.tuition_usd ?? null,
        program: row.program ?? null,
        programUrl: row.program_url ?? null,
        attached,
        options,
      },
    ];
  });

  const userName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null;
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return <SavedListClient rows={rows} userName={userName} userAvatarUrl={userAvatarUrl} />;
}
