# Admission Fit — Reach / Recommended / Safe grouping

Groups the university search results (`/universities`, the sidebar's **Search**
tab) into three personalised admission buckets so a student can instantly see
where they realistically stand:

| Bucket          | Meaning                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| **Reach**       | Selective relative to the applicant's current profile. Possible — but a stretch where GLOWBAL's coaching / mentorship can close the gap. |
| **Recommended** | Best overall fit for the applicant's likely grades and CV. Where we'd focus applications first.  |
| **Safe**        | The applicant comfortably exceeds the typical bar. Strong backup options.                        |

Grouping is **gated behind uploading a CV or a statement of purpose** — without
a document we can't reliably gauge profile strength, so the buckets stay locked
behind an upload CTA.

## How a university is classified

Two scores are combined per `(applicant, university)` pair:

```
profileStrength (0–100)   how strong the applicant looks on paper
selectivity     (0–100)   how hard the university is to get into
margin = profileStrength − selectivity
```

- `margin ≤ −12`  → **Reach**
- `−12 < margin < 12` → **Recommended**
- `margin ≥ 12`  → **Safe**

An illustrative admission probability (`≈ 50 + margin·1.1`, clamped 4–96%) is
shown on each card chip.

### Profile strength (`computeProfileStrength`)

A transparent weighted blend, surfaced with a factor breakdown:

| Factor                  | Weight | Source                                                                 |
| ----------------------- | ------ | ---------------------------------------------------------------------- |
| Academic grades         | 45%    | `predicted_grades`, `current_qualification`, `academic_background`, `grades_summary` — parsed for GPA / %, IB total, or A-levels. Neutral 0.6 when unparseable. |
| Statement of purpose    | 25%    | Best AI statement score on record (`personal_statements.ai_analysis.score`); neutral-positive when uploaded but unscored. |
| Experience & profile    | 18%    | English test level, work experiences, achievements, skills.            |
| CV / résumé             | 12%    | Whether a CV document is uploaded.                                     |

Because grades and CV/SOP quality dominate the score, **a stronger CV literally
shifts universities between buckets** — exactly the behaviour requested: the
same university can be a Reach for one student and a Safe for another.

### University selectivity (`computeUniversitySelectivity`)

Weighted blend of the strongest available signals, defaulting to a
mildly-selective 58 when nothing is known:

| Signal                         | Weight | Mapping                                            |
| ------------------------------ | ------ | -------------------------------------------------- |
| `accept_rate`                  | 0.50   | `100 − acceptance%`                                |
| `qs_rank`                      | 0.35   | Piecewise (rank ≤5 → 98 … rank >1000 → 40)         |
| `admission_difficulty` (text)  | 0.15   | Sentiment of phrases like "highly competitive".    |

## Architecture

| File | Role |
| ---- | ---- |
| `src/lib/admission-fit.ts` | Pure logic — strength, selectivity, classification, category metadata, grade parsers. Server- and client-safe. |
| `src/lib/explorer-utils.ts` | `ExplorerUniversity` gains an `admission: AdmissionFit \| null` field. |
| `src/app/universities/page.tsx` | Fetches strength signals (uploaded docs, statements, English scores, work experience), computes strength, classifies every university server-side, passes `admissionUnlocked` + `profileStrength`. |
| `src/lib/explorer-context.tsx` | Threads `admissionUnlocked` and `profileStrength` through the explorer provider. |
| `src/app/universities/university-explorer-client.tsx` | `CategoryTabs`, `CategoryBanner`, `MatchUnlockPanel`, per-card `AdmissionChip`; the results grid renders the active bucket when unlocked. |

### Data sources (read-only, per signed-in user)

- `uploaded_documents` — CV / statement presence (`type`).
- `personal_statements` — best `ai_analysis.score`, in-app statement presence.
- `english_test_scores` — `test_type` + `overall_score`.
- `work_experiences` — count.

All queries are lean and degrade gracefully (missing tables → empty arrays →
neutral defaults). No schema migration is required.

## UX

- **Locked** (no CV/SOP): the three tabs are replaced by a `MatchUnlockPanel`
  with a soft ghost-preview and an "Upload CV or statement" CTA →
  `/profile/documents`. The plain results list still renders so search stays
  usable.
- **Unlocked**: a three-up tab bar (Reach / Recommended / Safe) with live
  counts, a contextual banner describing the active bucket, and the results
  grid filtered to that bucket. Each card carries a coloured admission chip
  (bucket + estimated %). Counts are computed from the full filtered set so
  they stay stable across tab switches; an empty active tab auto-falls back to
  the first non-empty one.

## Tuning knobs

- `REACH_MARGIN` / `SAFE_MARGIN` in `admission-fit.ts` — bucket thresholds.
- Factor weights in `computeProfileStrength`.
- Selectivity weights / rank mapping in `computeUniversitySelectivity`.
