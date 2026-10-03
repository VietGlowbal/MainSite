# Saved universities on /apply

Updated 2026-10-04. Implementation: `src/app/apply/saved-list-section.tsx`,
`saved-action-dock.tsx`, and `features/universities/domain/saved-list.ts`.

- University headings link to `/universities/<id>`. The external official-site
  action keeps its existing behavior.
- Trash opens the shared Modal. No/Escape cancels; Yes invokes the existing
  remove mutation, loading state and toast path.
- Choose all reflects only current saved rows, including an indeterminate state.
  Removed IDs are pruned on server refresh; re-added rows do not inherit old ticks.
  Focus selection waits for a real row and follows incoming rows when focus and
  refresh change together. Reduced-motion focus scrolling is explicitly instant.
  Planning receives selected rows. Both dock scholarship actions use that same
  selection; browsing is disabled and an instruction appears when none is selected.
- Candidates group by scholarship id, retaining the eligible selected universities.
  Already attached awards remain excluded across all saved universities, including
  attachments outside the list or with a null university association. `/apply`
  carries matching attachment IDs from its existing read, retaining full options
  for row-local tuition joins. Shared awards show applicable-university chips;
  attachment requires an explicit university when
  multiple matches remain. A sole match is used directly.
- Card scholarship entry opens the same picker with only that row in scope,
  independently of dock selection. Subject selection, attached badges, computed
  tuition and scholarship detail remain available. Original tuition precedes the
  computed net amount. Arbitrary-host covers/crests use unoptimized images with
  placeholders on error; a changed source URL retries. These placeholders do not
  mean unavailable upstream assets loaded successfully.
- Plus gating still offers one highest-value and two lowest-value candidates to
  free accounts, with the remaining unique awards gated. `user_scholarships` still
  upserts on `user_id,scholarship_id`, linking an award to one chosen university;
  the picker therefore never offers an existing attachment as a new award.
  Success calls `router.refresh()`.
- Delete and card-picker dialogs follow saved-row IDs and close if their row is
  removed/replaced on refresh. Picker/detail panel switches reinitialize modal
  focus. Blurred Plus-only cards are inert and hidden from assistive technology.

The dock has one DOM instance. IntersectionObserver watches its reserved natural
slot (full visibility restores normal flow); ResizeObserver maintains its height
and content width as controls wrap. The slot includes the pinned bottom inset to
prevent a handover jump. A section-scoped focus listener instantly reveals row
controls covered by the pinned surface and is removed on unmount. There are no
scroll listeners. Without browser observers, including SSR, it stays in normal
flow. Shadow transitions respect
reduced motion, and the pinned dock accounts for the bottom safe area.

## Measured verification

Initial audit checks below used the local Node 22.15.0 runtime; shared CI was
not run for that checkpoint. Post-merge verification follows below.

- Regression audit initially reran the original **59 tests** successfully, then
  reproduced selection/dialog/focus/gating/image failures with new assertions.
  Final affected Vitest: **6 files / 109 tests passed**, including saved-list
  domain/component/dock, pricing, application scholarships and the `/apply` read.
  Coverage includes the exact MIT/Harvard/Stanford union, explicit target choice,
  existing attachments inside/outside the list, refresh reconciliation, row-local
  tuition, loading/error/cancellation, modal focus, inert gating, reduced motion,
  image failures, and dock observation/resize/SSR/focus-listener cleanup.
- `npm.cmd run typecheck`, `npm.cmd run typecheck:strict`, and ESLint on the nine
  touched source/test files passed (touched lint: zero errors/warnings).
- Final `npm.cmd run build:ci` passed and generated 151 pages. Its placeholder
  Supabase Home reads reported fetch failures; the existing Edge warning remains.
- `node scripts/check-i18n.mjs`: zero missing static keys, placeholder mismatches,
  or dynamic-catalog misses. `git diff --check` passed.
- Playwright checked `/dev/saved-list` at 360, 768 and 1440px: no horizontal overflow,
  one dock switching between pinned/natural positions, mobile modal focus and
  layering below the modal/navigation, and reduced-motion transition removal.
  At 360x800, the old 16px handover jump was reproduced and eliminated by matching
  the natural inset. An obscured focused link was revealed above the dock.
  Browser artifacts are in ignored `output/playwright/`.

No schema, additional query, dependency or unrelated-page changes. The `/apply`
read model adds matching existing-attachment IDs from already fetched data.
Browser checks used the existing read-only preview; mutations were verified with component mocks,
not against a signed-in account. The initial audit did not rerun the full
repository suite/E2E.
Old-project university cover requests still return HTTP 402; unavailable upstream
image bytes were not repaired by this UI change.

## Post-audit main synchronization (2026-10-04)

Merged main `57e91918` into the existing feature branch. The only conflict was
`docs/current-status.md`; both histories were retained. Saved Universities
source/tests are unchanged, and the automatic report-repository/i18n merges
preserve both branches' behavior. No schema or dependency changes were added.

The unchanged `npm run verify:pr` gate passed with Node 24.19.0/npm 10.9.2:
base/strict TypeScript, full lint (zero errors/nine existing warnings), **454
files / 4,289 passing tests / two todo**, coverage thresholds, and `build:ci`
(151 pages). Coverage: statements 74.40%, branches 65.32%, functions 75.27%,
lines 77.08%. i18n and whitespace checks passed. Node's downloaded executable
matched the official SHA-256 checksum and stays in ignored `output/`.
Local E2E was not rerun; fresh shared CI is required for the resulting commit.
The pre-existing untracked personalization plan remains excluded.
