# GlowBal RnD feedback audit — 2026-09-08

Baseline: `main` at `0595e2c76fe859baf607adb6cf52eb3149c2987d`.

This is an evidence matrix for the pasted RnD feedback. “Confirmed” means the
repository or live read-only probe demonstrates the behavior. It does not mean
that an unreviewed production migration is safe to apply.

| Feedback item | Evidence / root cause | Classification | Severity | Disposition / acceptance |
|---|---|---|---|---|
| Database-wide RLS exposure / anon CRUD | `docs/known-issues.md` §0h and `docs/audit-2026-09-05-database.md` record anon probes: protected tables return zero rows; 0/108 live tables lack RLS; no weak `auth.uid() IS NOT NULL` policy; 0/5 views lack `security_invoker`; 0/31 definer functions lack pinned `search_path`. | False positive for the reported confidentiality breach; measured RLS posture is working. | High if misdiagnosed | No data mutation. Re-run the catalog probe against the production project after schema changes. |
| A1: `add_selected_courses_to_apply` trusts `p_user_id` | `sql/supabase-add-selected-courses-rpc.sql:66` is a `SECURITY DEFINER` migration with caller-supplied user id; the RPC is absent from the live PostgREST schema. | Confirmed latent defect / migration review, not a live exploit. | High if applied | Fix before applying: derive `auth.uid()` or reject mismatch, and bind the session. Acceptance: SQL-editor definition and authenticated cross-user negative test. |
| A7: anon DML grants | Live audit records broad default anon grants, while RLS currently denies the writes. | Confirmed structural hardening gap, not current exploit. | Medium | Product/route audit required before a permission migration. Acceptance: revoke anon DML on student/payment domains, then run anonymous public-read and authenticated route regression probes. |
| A8: logged-in users can insert shared `courses` | Live policy allows authenticated inserts with `auth.role() = 'authenticated'`; the shared catalogue has no ownership/moderation field. | Confirmed integrity risk / product decision. | Low–medium | Decide whether catalogue writes are service-role-only. Acceptance: direct authenticated insert denied after hardening; import/promotion path still succeeds. |
| Other database follow-ups (A2/A3/A6/A9) | Audit records overly broad mentor profile reads, public staff email, `user_entitlements` policy absent from version control, and programme target-profile versions readable to authenticated users. | Confirmed follow-ups / product or data-owner review. | Low–medium | Keep separate from the RLS false-positive claim. Acceptance is a documented projection/policy decision plus read probes; no destructive test against student data. |
| Scholarship filters | `supabase-scholarship-repository.ts:listPublishedUncached` filters major/degree through free-text columns (`eligibility`, `applies_to_text`, `conditions`, `insight`) and funding through `funding_type`; live schema has no normalized major/degree taxonomy. | Confirmed data-model weakness; missing verified taxonomy/source evidence. | High | Requires additive taxonomy migration, normalization/review provenance, unknown bucket, and query fixtures. Do not fabricate values or deploy until source review is complete. |
| Saved scholarship at multiple universities | Live `user_scholarships` is keyed by one `(user, scholarship, university)` row and the UI reads one row per scholarship; no application relation exists. | Confirmed data-model limitation / migration required. | High | Requires many-to-many destination relation, backfill/rollback plan, UI/API/apply changes, and duplicate-preserving tests. Not shipped in this patch because it needs an additive production migration and product confirmation. |
| University-specific scholarship context, pagination, reset | `directory-loader.ts` loads focus and same-country pages separately; client renders independent paginators and resets `page`/`countryPage` on filters. | Fixed previously; source regression coverage exists. | Medium | Acceptance: deep link shows target-university section, same-country fallback, independent page URLs, filter reset, and “show all” clears focus. Browser run remains pending. |
| Catalogue coverage | Read-only live counts: 2,877 published scholarships, 99 universities, 374 link rows/unique linked scholarships, 604 `courses`, 604 `catalog_programmes`. | Confirmed coverage gap by measured count; source completeness not inferred. | High | Coverage task needs official-source inventory and reviewed import plan. No fabricated university/scholarship rows. |
| Program URL / “No subject” save | `ProgramPicker` previously performed an unscoped client update and treated a zero-row update as success. It now calls `PATCH /api/my-universities/program`, validates URL/domain and input, scopes update to `user_id`, returns the selected row, and reports 404/503/500 visibly. `/api/applications/from-saved-university` already reads the authoritative row. | Confirmed bug, fixed with regression tests. | High | Acceptance: catalog, supported URL, unsupported URL, malformed input, zero-row, duplicate/reload, and apply-flow tests; route test covers owner scope/canonical response/zero-row. |
| VinUni + CBM generation hang | Existing VinUni analyzer and personal-report/planner paths have terminal/error handling and focused tests in the current status; no independent browser reproduction was possible without the Playwright binary and a dedicated account. | Reproduction required; no AI-engine rewrite. | High | Run with a dedicated test account, capture lifecycle events and terminal state, verify idempotency and absence of raw essay logging. |
| Guide action links / scrolling | `strategy-help-button.tsx` and `strategy-guide.tsx` render step-derived links; current guide panel has bounded flex scrolling. Shared `Modal` now traps Tab, handles Escape, and restores opener focus. | Previously fixed plus new accessibility regression test. | Medium | Acceptance: all 14 links, mobile/desktop scroll, keyboard traversal, Escape, and focus return in browser. |
| Footer/navigation “Student stories” | `FOOTER_COLUMNS` labels `/achievers` as “Student stories”; `/achievers/page.tsx` intentionally redirects to `/advisors`. | Confirmed IA/content mismatch; product decision, not silently changed. | Medium | Decide whether the label should be “Student advisors,” a real stories destination, or removal. Acceptance: label and destination describe the same content. |
| Contact consent and validation | `home-contact.tsx` has a separate required communication-consent checkbox; `contact-details.ts` and `/api/account/contact-details` validate normalized phone/name. | Previously fixed; existing tests pass. | Medium | Acceptance: invalid phone, missing consent, valid submit, and privacy-link checks. |
| Mobile overflow / disabled controls | Existing Playwright specs cover mobile navigation and home overflow, but Chromium is unavailable on this host. No new code evidence proves every audited viewport/control state. | Reproduction required. | Medium | Run browser matrix at 375/768/1024/1440 widths, keyboard focus, disabled controls, and no horizontal scroll. |
| Performance | `docs/performance.md` and current-status contain prior measured waterfall/CLS work; no new production Lighthouse/RUM measurement was requested or possible from unit tests. | Previously fixed / remeasure required. | Medium | Capture current production LCP/CLS/INP, bundle and request waterfall before further optimization. |
| SEO slugs | `scholarships.slug` exists and scholarship metadata/sitemap are implemented; live `universities` has no slug column, so university URLs remain numeric. | Confirmed partial implementation; data/migration decision. | Medium | Add verified university slug/backfill and redirect policy only after uniqueness/collision review; test canonical, hreflang, sitemap, and old numeric redirects. |
| Health endpoint | No `/api/health` route existed; added `GET /api/health` with `{status:"ok"}` and `Cache-Control: no-store`. | Confirmed missing endpoint, fixed with test. | Low | Acceptance: 200/no-store/liveness response; keep readiness/dependency checks separate and bounded. |
| Specific majors | Existing subject catalog has broad categories; exact major taxonomy affects matching/filter semantics. | Product decision. | High | Owner must approve canonical major list, aliases, unknown behavior, and evidence policy before schema/code work. |
| Profile strength vs completion | Current onboarding/profile flows distinguish required completion gates from richer application/profile content. | Product decision. | Medium | Owner must define the displayed metric and acceptance examples before changing scoring/UI. |
| Admission difficulty | No verified, consistently sourced difficulty field was established in this audit. | Missing data / product decision. | High | Approve definition, source, freshness, confidence, and unknown display before adding it. |
| Homepage demo / CTA | Existing home preview and CTA behavior are covered by unit/E2E source, but browser execution was blocked. | Reproduction plus product approval. | Medium | Decide primary conversion action, then verify CTA destination and mobile rendering in browser. |
| Academic vs non-academic | Existing subject/catalog model is academic-programme oriented; broader non-academic scope is not established in live schema. | Product decision. | Medium | Approve scope and data model before changing taxonomy or matching. |

## Changes made

- Added [`consent-boundary.tsx`](../../src/components/privacy/consent-boundary.tsx), its tests, and the footer settings trigger; removed unconditional root-layout Analytics/Speed Insights mounting.
- Added [`program/route.ts`](../../src/app/api/my-universities/program/route.ts) and tests; routed [`program-picker.tsx`](../../src/app/my-universities/program/program-picker.tsx) through it.
- Added [`health/route.ts`](../../src/app/api/health/route.ts) and its test.
- Added Tab trapping to [`modal.tsx`](../../src/shared/ui/modal.tsx) and its regression test.
- Used a transition for URL-driven country state in [`university-list-client.tsx`](../../src/app/universities/university-list-client.tsx) so the repository lint gate passes.
- Added the consent strings to [`i18n-dictionary.ts`](../../src/lib/i18n-dictionary.ts) and recorded this audit in [`current-status.md`](../current-status.md).

### Follow-up pass — third-party requests that bypassed the consent boundary

The consent boundary gates the analytics *scripts*. A later check of what the
browser actually requests found three paths around it; see `current-status.md`
for the measured detail.

- Copied the three hot-linked scholarship marks into `public/brand/scholarships/`
  and pointed [`home-scholarship-branding.ts`](../../src/features/marketing/ui/home-scholarship-branding.ts)
  at them, so the home page issues no cross-origin request before the banner is
  answered. None of those hosts was in the CSP's `img-src` either.
- Added [`university-logo/route.ts`](../../src/app/api/university-logo/route.ts)
  and switched the favicon fallback in [`wiki-images.ts`](../../src/lib/wiki-images.ts)
  to it, moving the call to Google from the browser to the server. Domain-only
  input, so it is not a general proxy. `sql/supabase-university-logo-first-party.sql`
  rewrites already-stored rows — **not run.** Its first run failed with 42703:
  live enumeration confirms `logo_url` exists only on `universities`, never on
  `course_applications` despite `supabase-apply-system.sql` declaring it, so the
  migration is now single-table. Three rows are affected, and all three are
  domains Google has no favicon for, so they will fall back to the app's own
  initials mark instead of the grey globe Google serves them today.
- Gated `gb_visitor` in [`c/[code]/route.ts`](../../src/app/c/[code]/route.ts) on
  consent, via a new `gb_consent` mirror cookie
  ([`consent-cookie.ts`](../../src/shared/lib/consent-cookie.ts)) that lets server
  code read a choice stored in localStorage. Owner chose legal safety over the
  metric; unique-visitor counts now cover consenting visitors only.
- Fixed a `vitest.config.ts` gap the new route test exposed: route tests outside
  `src/app/api` matched no project and ran nowhere, silently counting as passing.

Not changed, reported instead: avatar / mentor-logo `<img>` tags still accept
arbitrary hosts from the database and OAuth, and `/privacy` §8 names no
processor and lists no cookie. The second is legal copy and is the owner's to
write.

## Verification

Passed:

- `npm.cmd test` — 392 files; 3,699 passed, 2 TODOs.
- `npm.cmd run typecheck` and `npm.cmd run typecheck:strict` — passed.
- `npm.cmd run lint` — passed with four existing unused-variable warnings.
- `node scripts/check-i18n.mjs --all` — 0 missing static/dynamic keys; 0 placeholder mismatches.
- `npm.cmd run build` — passed; existing `geo-content.ts` tracing warnings and Edge-runtime deprecation warning remain.
- Focused audit tests — 12 files/64 tests, then modal follow-up 4 files/9 tests — passed.
- Read-only live REST inspection — completed; no writes or destructive probes.

Blocked:

- `npm.cmd run verify:pr` stops at `check:node`: repository requires Node 24.19.0, host has 24.13.0.
- `npm.cmd run test:e2e` cannot launch Chromium because the Playwright executable is not installed; 57 browser tests failed at launch and 6 credential-gated tests skipped.

No SQL migration was applied or added by this audit. The saved-program columns
are already present in the live `user_universities` schema; the requested
many-to-many scholarship destination work remains a separate additive migration
and deployment task.
