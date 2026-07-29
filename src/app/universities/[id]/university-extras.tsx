import { Badge } from '@/shared/ui';
import {
  VINUNI_UNIVERSITY_ID,
  vinuniColleges,
  vinuniFaq,
} from '@/lib/vinuni-content';
import { SopAaccSection } from '../vinuni/vinuni-profile-client';
import type { DetailSection } from './university-detail';

/**
 * Per-university extra sections.
 *
 * VinUni is the only university with content beyond its `universities` row, and
 * this is how it keeps it. The owner's instruction on 2026-07-28 was that the
 * frontend moves to the shared design while the information stays — so this is
 * an EXTENSION, not a migration. Nothing was copied into new columns, where the
 * other 96 rows would have had nothing to put in them.
 *
 * The content itself was already in the right shape: typed constants in
 * src/lib/vinuni-content.ts, not inlined in the old page component. That module
 * is the source of truth and is unchanged.
 *
 * ⚠️ NOT EVERYTHING FROM THE OLD PAGE IS HERE YET. `vinuniScholarships`,
 * `vinuniFinancials`, `vinuniAdmissions`, `vinuniCareer` and `vinuniCampusLife`
 * overlap columns the shared sections already render from the database, so
 * duplicating them would make the page say the same thing twice with two
 * different numbers. Deciding which wins is a content call for the owner, and
 * until then the database version is the one shown. Only the two that have NO
 * database equivalent are rendered below.
 *
 * The SOP / AACC analyser comes across too. It is a *feature* parked on a
 * university page rather than university content — it calls
 * /api/ai/analyze-statement-aacc and is fed by VINUNI_AACC_PILLARS and
 * vinuniSopGuidance — and it belongs with /ai-strategy. But it is live today,
 * so it is rendered here rather than dropped when /universities/vinuni started
 * redirecting. See docs/redesign-status.md.
 */

/** Extra anchors these sections add to the bar at the top of the page. */
export function extraSectionsFor(universityId: number): DetailSection[] {
  if (universityId !== VINUNI_UNIVERSITY_ID) return [];
  return [
    { id: 'programmes', label: 'Programmes' },
    { id: 'statement', label: 'Statement review' },
    { id: 'faq', label: 'FAQ' },
  ];
}

export function UniversityExtras({
  universityId,
  isSignedIn,
}: {
  universityId: number;
  isSignedIn: boolean;
}) {
  if (universityId !== VINUNI_UNIVERSITY_ID) return null;

  return (
    <>
      {/* Colleges and programmes — no equivalent column exists on `universities`. */}
      <section className="flex flex-col gap-gb-2xl">
        <h2
          id="programmes"
          className="scroll-mt-gb-9xl font-display text-gb-display-sm font-semibold text-fg"
        >
          Colleges and programmes
        </h2>
        <div className="flex flex-col gap-gb-xl">
          {vinuniColleges.map((college) => (
            <div key={college.id} className="rounded-gb-xl border border-line p-gb-3xl">
              <div className="flex flex-wrap items-baseline gap-gb-lg">
                <h3 className="text-gb-lg font-semibold text-fg">{college.name}</h3>
                <Badge variant="neutral">{college.shortName}</Badge>
              </div>
              <p className="mt-gb-md text-gb-md text-fg-tertiary">{college.tagline}</p>
              <ul className="mt-gb-xl flex flex-col gap-gb-md">
                {college.programs.map((program) => (
                  <li
                    key={program.name}
                    className="flex flex-wrap items-baseline justify-between gap-gb-md border-t border-line pt-gb-md text-gb-sm"
                  >
                    <span className="font-medium text-fg">{program.name}</span>
                    <span className="text-fg-tertiary">
                      {program.degree} · {program.durationYears} years
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* The AACC statement analyser, carried over so the redirect from
          /universities/vinuni loses nothing. It brings its own styling. */}
      <section id="statement" className="scroll-mt-gb-9xl">
        <SopAaccSection isLoggedIn={isSignedIn} />
      </section>

      {/* FAQ — also has no column equivalent. */}
      <section className="flex flex-col gap-gb-2xl">
        <h2
          id="faq"
          className="scroll-mt-gb-9xl font-display text-gb-display-sm font-semibold text-fg"
        >
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-gb-md">
          {vinuniFaq.map((entry) => (
            <details
              key={entry.question}
              className="group rounded-gb-xl border border-line p-gb-3xl"
            >
              <summary className="cursor-pointer list-none text-gb-md font-semibold text-fg">
                {entry.question}
              </summary>
              <p className="mt-gb-lg text-gb-md text-fg-tertiary">{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
