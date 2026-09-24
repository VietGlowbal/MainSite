import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getUniversityQueries } from '@/features/universities/api';
import { programChoices, type CatalogueEntry } from '@/features/universities/domain';
import { createClient } from '@/lib/supabase/server';
import { VINUNI_UNIVERSITY_ID, vinuniColleges } from '@/lib/vinuni-content';
import { ProgramPicker } from './program-picker';

/**
 * /my-universities/program?u=<universityId> — "Chọn lại ngành", Figma 375:13546.
 *
 * A ROUTE, THOUGH THE FRAME DRAWS A DIALOG. The frame is a modal floating over a
 * dimmed page, and the product owner asked for the saved row's "Chọn lại ngành
 * tại đây" to *direct* the student here. Both are satisfied by a real URL that
 * renders the modal surface centred on its own page: the link is a navigation
 * (shareable, back-button-able, and it survives a refresh mid-choice), and it
 * still looks like the frame.
 *
 * ⚠️ A PREVIOUS SESSION FILED THIS FRAME UNDER THE WRONG FLOW, and the note is
 * still in docs/redesign-status.md: it reads the frame's dimmed background
 * ("Reflection / 1/3 / What is your highest level… / ILETS") and concludes the
 * picker belongs to /ai-strategy, grouped under the "Trang lưu" banner by spatial
 * position only. The background is indeed the Reflection page — the designer
 * reused it as a backdrop — but the owner has since confirmed the intent
 * directly: the saved row's link opens this. The frame sits in the Trang lưu
 * cluster because that is where it is used.
 *
 * Which segment this is: `program` is a static sibling of `[id]`, and Next.js
 * matches static before dynamic, so this does not shadow /my-universities/<id>.
 * The university arrives as `?u=` rather than as a path segment for exactly that
 * reason — one fewer ambiguous route.
 *
 * WHERE THE OPTIONS COME FROM. VinUni uses its complete typed catalogue from
 * `vinuni-content.ts`; every other university uses `universities.strengths`.
 * This restores the original subject-picker source while the database
 * catalogue remains incomplete for VinUni.
 */

export const metadata: Metadata = {
  title: 'Choose your subject | GlowBal',
  description: 'Pick the subject you want to apply for at a university on your saved list.',
};

const VINUNI_CATALOGUE: readonly CatalogueEntry[] = vinuniColleges.flatMap((college) =>
  college.programs.map((program) => ({
    name: program.name,
    degree: program.degree,
    durationYears: program.durationYears,
    units: [{ name: college.name, isPrimary: true }],
  })),
);

export default async function ChooseProgramPage({
  searchParams,
}: {
  // `next` is where saving returns to. /apply sends the student here mid-flow
  // when "Plan my application" hits a row with no subject, and wants them back
  // on ?planFor=<id> so the application can be created. Defaults to /apply.
  searchParams: Promise<{ u?: string; next?: string }>;
}) {
  const { u, next } = await searchParams;
  const universityId = Number.parseInt(u ?? '', 10);
  if (!Number.isFinite(universityId)) notFound();

  /*
   * Only same-origin paths, the same guard src/proxy.ts uses on its own
   * ?redirect. A `next` off this site would turn a saved subject into an open
   * redirect.
   */
  const returnTo = next?.startsWith('/') ? next : '/apply';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // src/proxy.ts gates /my-universities/*; this is the belt-and-braces guard.
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/my-universities/program?u=${u}`)}`);

  /*
   * The saved row, not just the university. Landing here for a university the
   * student has not saved would offer them a choice with nowhere to store it, so
   * that is a 404 rather than a silent no-op at save time.
   *
   * `select('*')` for the same reason as the list page: `program` may not exist
   * yet (supabase-saved-program.sql), and naming it would fail the whole read.
   */
  const { data: savedRow } = await supabase
    .from('user_universities')
    .select('*')
    .eq('user_id', user.id)
    .eq('university_id', universityId)
    .maybeSingle();

  if (!savedRow) notFound();

  const saved = savedRow as { id: number; program?: string | null; program_url?: string | null };

  const [university] = await getUniversityQueries().getByIds([universityId]);
  if (!university) notFound();

  const choices = programChoices(
    university.strengths,
    universityId === VINUNI_UNIVERSITY_ID ? VINUNI_CATALOGUE : undefined,
  );

  return (
    <ProgramPicker
      savedId={saved.id}
      universityName={university.name}
      universityLogoUrl={university.logo_url ?? null}
      choices={choices}
      initialProgram={saved.program ?? null}
      initialProgramUrl={saved.program_url ?? null}
      returnTo={returnTo}
    />
  );
}
