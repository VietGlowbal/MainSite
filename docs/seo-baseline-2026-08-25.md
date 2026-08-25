# GlowBal SEO Visibility Baseline (2026-08-25)

## 1. Executive Summary

This document captures the baseline SEO posture of **GlowBal** (`https://glowbal-education.com/`) recorded on **2026-08-25**.

- **Status of Google Search Console (GSC) direct export:** `BLOCKED: GSC credentials required` (API/portal credentials not available in local test environment; baseline compiled from live crawl analysis, codebase indexability audits, and database checks).
- **Core observations:**
  - `/`, `/robots.txt`, `/sitemap.xml` return `200 OK`.
  - `robots.txt` points to `https://glowbal-education.com/sitemap.xml`.
  - Previous sitemap included `/apply` (which 307-redirected to `/auth`), creating a crawl loop on private application routes.
  - Previous sitemap generated dynamic timestamps (`new Date()`) on every invocation, causing cache thrashing and false crawl churn.
  - `/news/[slug]` pages lacked explicit `canonical` tags in `generateMetadata`.
  - Public news CMS rows had at least 2 entries with generator draft copy (`"A Glowbal draft guide..."`) that required a hard publication gate.

---

## 2. Query Cohorts & Target Keywords

| Cohort | Representative Queries | Primary Landing Page Intent |
|---|---|---|
| **Brand EN** | `GlowBal`, `GlowBal education`, `GlowBal study abroad` | `/` (Homepage) |
| **Brand VI** | `GlowBal du học`, `GlowBal học bổng` | `/`, `/scholarships` |
| **Non-brand Scholarships (VI)** | `học bổng du học Anh`, `học bổng thạc sĩ dữ liệu`, `tìm học bổng quốc tế` | `/scholarships`, `/news/[slug]` |
| **Non-brand Universities** | `vinuni admissions`, `study in uk universities`, `university entry requirements` | `/universities/[id]`, `/universities` |
| **Advisors & Mentorship** | `cố vấn du học 1-1`, `mentor săn học bổng`, `study abroad counseling` | `/advisors`, `/advisors/[id]` |

---

## 3. Indexability & Coverage Audit

### 3.1 Public Indexable Target Set
- `/` (Home)
- `/about`
- `/how-it-works`
- `/news`
- `/news/[slug]` (Published, verified guides only)
- `/universities`
- `/universities/[id]`
- `/advisors`
- `/advisors/[id]`
- `/scholarships` (Public crawlable directory preview)

### 3.2 Private Non-Search Set (Must be `noindex, nofollow`)
- `/auth` & `/auth/**`
- `/apply` & `/apply/**`
- `/profile` & `/profile/**`
- `/dashboard` & `/dashboard/**`
- `/admin` & `/admin/**`
- `/onboarding` & `/onboarding/**`
- `/ai-strategy` & `/ai-strategy/**`
- `/payment/**`, `/plus/success`, checkout & return flows

---

## 4. Remediation Progress

- [x] **Task 2**: Hard publication gate implemented (`src/lib/geo-cms-validation.ts`) blocking `TODO_SOURCE_REQUIRED`, generator draft copy, and unverified tuition/entry claims from rendering publicly.
- [ ] **Task 3**: Public/Private indexability classifier and `robots: { index: false, follow: false }` metadata layout coverage.
- [ ] **Task 4**: Truthful, stable sitemap (remove `/apply`, add `/about` and `/how-it-works`, use real modified dates).
- [ ] **Task 5**: Canonical tags & JSON-LD structured data on all public templates.
- [ ] **Task 6**: Public `/scholarships` crawlable preview.
- [ ] **Task 8**: Automated regression check script (`scripts/check-seo.mjs`).
