import { notFound } from 'next/navigation';
import { SavedListClient, type SavedRow } from '@/app/my-universities/saved-list-client';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { getUniversityQueries } from '@/features/universities/api';
import { formatTuitionForCard, officialWebsite, splitList } from '@/features/universities/domain';

/**
 * /dev/saved-list — design preview for /my-universities (Figma 375:12701,
 * 375:12841, 375:13295, 375:13369, 502:18462).
 *
 * Exists because the real route is the hardest page in the app to look at: it
 * sits behind the auth gate AND the onboarding gate in src/proxy.ts, so reviewing
 * it normally means holding a signed-in account with a completed profile, and
 * then saving enough universities to see every state.
 *
 * ⚠️ AN EARLIER VERSION OF THIS COMMENT WAS WRONG, and it is the kind of wrong
 * that costs a session: it stated that `public.user_universities` was MISSING
 * from the project and that every save silently no-opped. That was true when it
 * was written and is not true now — the table exists and holds rows (queried
 * live 2026-07-30 with the service key). If you need to know the state of a
 * table, query it; see docs/known-issues.md §0.
 *
 * This page composes the same rows the real one would, from the SAME
 * repositories, with only the `user_universities` read replaced: it takes the
 * first few universities in the directory instead of the ones a student saved.
 * Everything downstream is real — names, countries, rankings, tuition,
 * deadlines, cover images, crests, and the scholarships genuinely linked to
 * those universities via `scholarship_universities`.
 *
 * ⚠️ WHICH UNIVERSITIES APPEAR HERE IS NOT STUDENT DATA. It is "the first rows
 * the directory returns", chosen by this file. Nothing is written, because
 * nothing is signed in. The `attached` list and the chosen subject are likewise
 * previews of the scholarship-attached state (375:12841) and the "Ngành …" line
 * (375:12743), not anyone's real plan.
 *
 * Same gate as /dev/home and /dev/kitchen-sink: hidden in production unless
 * ENABLE_DEV_ROUTES is set.
 */

/** Enough rows to show the grid rhythm without turning this into a long page. */
const PREVIEW_COUNT = 4;

export default async function SavedListPreviewPage() {
  const enabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  const universities = await getUniversityQueries().list({
    page: 1,
    pageSize: PREVIEW_COUNT,
  });
  const ids = universities.items.map((uni) => uni.id);
  const linked = await getScholarshipQueries().byUniversityIds(ids);

  const rows: SavedRow[] = universities.items.map((uni, index) => {
    const options = (linked.get(uni.id) ?? []).slice(0, 4).map((s) => ({
      id: s.id,
      name: s.name,
      amountLabel: s.amountLabel,
      deadlineLabel: s.deadlineLabel,
      coverage: s.coverage,
      // What the discount maths reads — the bar's percentage and the row's net.
      fundingType: s.fundingType,
      amountMin: s.amountMin,
      amountMax: s.amountMax,
      amountCurrency: s.amountCurrency,
      // Detail-panel fields (Figma 375:13369) — real columns, like the rest.
      scope: s.scope,
      eligibility: s.eligibility,
      conditions: s.conditions,
      insight: s.insight,
      appliesToText: s.appliesToText,
      sourceUrl: s.sourceUrl,
    }));

    // Give exactly one row an attached scholarship so the 375:12841 state is
    // visible, and so the picker's "already attached" filter is exercised.
    const attached =
      index === 1 && options[0]
        ? [
            {
              savedId: -1,
              id: options[0].id,
              name: options[0].name,
              amountLabel: options[0].amountLabel,
            },
          ]
        : [];

    return {
      id: uni.id,
      universityId: uni.id,
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
      tuition: formatTuitionForCard(uni.tuition_usd),
      tuitionRaw: uni.tuition_usd ?? null,
      /*
       * One row previews the chosen-subject state and the rest the empty one, so
       * both halves of ProgramRow are visible at a glance. The value is the
       * university's OWN first strength, not an invented course name — same rule
       * as everywhere else on this page.
       */
      program: index === 0 ? (splitList(uni.strengths)[0] ?? null) : null,
      programUrl: null,
      attached,
      options,
    };
  });

  return <SavedListClient rows={rows} userName="Preview user" userAvatarUrl={null} />;
}
