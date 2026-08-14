# AI Strategy route audit

This document records the route consolidation performed with the Personal Report rebuild. It is deliberately explicit about compatibility adapters that remain so future work does not mistake them for a second product implementation.

## Product ownership

| Product concept | Ownership | Canonical route | Current implementation status |
| --- | --- | --- | --- |
| Reflections | User | `/ai-strategy/reflection` | Keep |
| Achievements / evidence | User | `/ai-strategy/reflection/achievements` | Keep |
| Personal Report | User | `/ai-strategy/personal-report` | Canonical V2 |
| Matching Report | Application | `/ai-strategy/[applicationId]/matching-report` | Canonical route over current Programme Fit implementation; F5 rebuild is next phase |
| Strategy Report | Application | `/ai-strategy/[applicationId]/strategy-report` | Canonical route over current F7 workspace; F7 rebuild follows Matching |
| Planner | Application | `/ai-strategy/[applicationId]/planner` | Canonical route over current planner implementation |
| CV Support | Application | `/apply/[applicationId]/cv` for now | **Compatibility hold**: two CV systems still require an intentional data/UI merge |
| Essay Support | Application | `/apply/[applicationId]/statement-feedback` for now | **Compatibility hold**: current live workflow retained until Essay consolidation |
| Scholarship Finder | Application intent, global catalogue today | Not yet implemented as an application workspace | Future phase |
| Final Application Check | Application | Not yet implemented | Future phase |

## Old → new route mapping

| Previous route | Previous purpose | Decision | Canonical destination |
| --- | --- | --- | --- |
| `/ai-strategy/report` | Old user-level Personal Report V1 | REDIRECT | `/ai-strategy/personal-report` |
| `/ai-strategy/[applicationId]/strategy/analysis/portrait` | Application-scoped Applicant Portrait incorrectly labelled as Personal Report | REDIRECT | `/ai-strategy/personal-report` |
| `/ai-strategy/matching/[applicationId]` | Older Matching Report surface | REDIRECT | `/ai-strategy/[applicationId]/matching-report` |
| `/ai-strategy/[applicationId]/strategy/analysis/fit` | Newer Programme Fit view | REDIRECT | `/ai-strategy/[applicationId]/matching-report` |
| `/ai-strategy/[applicationId]/strategy/analysis/recommendation` | Personalized Strategy report | REDIRECT | `/ai-strategy/[applicationId]/strategy-report` |
| `/ai-strategy/[applicationId]/strategy/dashboard` | Planner / recommendation dashboard | REDIRECT | `/ai-strategy/[applicationId]/planner` |
| `/ai-strategy/[applicationId]/strategy/recommendations/[recommendationId]` | Planner task detail | KEEP temporarily | Child of Planner; route rename can happen with Planner task contract phase |
| `/ai-strategy/[applicationId]/strategy` | Application strategy onboarding/front door | KEEP as onboarding compatibility route | Routes into the appropriate canonical report/workspace once onboarding state permits |
| `/ai-strategy/[applicationId]/strategy/analysis` | Generation gate | KEEP as orchestration step, not a report | Generates/checks internal dependencies then hands off to canonical reports |

## Important internal compatibility dependency

`applicant_analyses` is **not** a second Personal Report anymore. The user-facing Applicant Portrait route now redirects to the global Personal Report.

The row is temporarily retained because the current Strategy recommendation generator and onboarding completion state still consume it. Treat it as an internal adapter scheduled for removal when the Strategy/F7 engine is migrated to structured `ProfileEvaluation` + `ProgrammeFitEvaluation` inputs.

Deleting `applicant_analyses` in this phase would break the current Strategy flow. Rendering it as a Personal Report would recreate the product duplication this cleanup is intended to remove.

## CV consolidation decision

There are two existing CV systems and neither should be deleted wholesale without migration:

- `/apply/[applicationId]/cv*`: more recently maintained UX and stronger component coverage.
- `/ai-strategy/[applicationId]/cv/*`: stronger persisted domain model (`application_strategies`, `cv_target_profiles`, `structured_cvs`, `cv_reviews`, export/staleness support).

Target architecture: **one CV product using the persisted backend/domain model from the AI Strategy implementation and the strongest current UX from the Apply implementation**. Until that dedicated merge is performed, primary navigation remains on the current `/apply/[applicationId]/cv` workflow to avoid switching users to a partially different state model.

## Essay consolidation decision

Statement feedback and statement writing share underlying statement data/analysis capability but still have multiple shells. The target is one Essay Support workspace, with writing and feedback as modes. Until that migration is completed and tested, the existing application navigation remains on the current live Statement Feedback flow.

## Navigation source of truth

Application navigation now reads `src/shared/lib/ai-strategy-route-model.ts`.

It encodes the key ownership rule directly:

- Personal Report has no `applicationId`.
- Matching Report, Strategy Report and Planner preserve `applicationId`.
- CV/Essay are explicit compatibility routes pending their dedicated merge.

Old route-specific links should not be added back into page components.
