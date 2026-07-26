import { notFound } from 'next/navigation';
import { SavedListClient, type SavedRow } from '@/app/my-universities/saved-list-client';
import { getScholarshipQueries } from '@/features/scholarships/api';
import { getUniversityQueries } from '@/features/universities/api';
import { officialWebsite } from '@/features/universities/domain';

/**
 * /dev/saved-list — design preview for /my-universities (Figma 223:8824,
 * 223:13621, 223:13022).
 *
 * Exists because the real route is the hardest page in the app to look at. Two
 * reasons, and the second is the important one:
 *
 *  1. It sits behind the auth gate AND the onboarding gate in src/proxy.ts, so
 *     reviewing it normally means holding a signed-in account with a completed
 *     profile.
 *  2. `public.user_universities` is MISSING from the Supabase project this repo
 *     currently points at (supabase-schema.sql:151 is the migration that creates
 *     it). Until it is applied, saving a university silently no-ops everywhere —
 *     the heart on /universities, /api/home/save-university, the /apply
 *     shortlist — so the real page can only ever render its empty state, no
 *     matter who signs in.
 *
 * So this page composes the same rows the real one would, from the SAME
 * repositories, with only the `user_universities` read replaced: it takes the
 * first few universities in the directory instead of the ones a student saved.
 * Everything downstream is real — names, countries, rankings, deadlines, cover
 * images, crests, and the scholarships genuinely linked to those universities
 * via `scholarship_universities`.
 *
 * ⚠️ WHICH UNIVERSITIES APPEAR HERE IS NOT STUDENT DATA. It is "the first rows
 * the directory returns", chosen by this file. Nothing is written, because
 * nothing is signed in. The `attached` list is likewise a preview of the
 * scholarship-attached state (Figma 223:13621), not anyone's real plan.
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
    }));

    // Give exactly one row an attached scholarship so the 223:13621 state is
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
      attached,
      options,
    };
  });

  return <SavedListClient rows={rows} userName="Preview user" userAvatarUrl={null} />;
}
