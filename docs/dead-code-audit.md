# Dead Code Audit — GlowBal MainSite

> Phục vụ phiên dọn code sắp tới. Quét ngày 2026-08-22 trên working tree
> `fix/i18n-overhaul` @ `6edb77fc`. Xoá xong batch nào thì tick batch đó và xoá
> mục tương tự khỏi file này (docs là bản bàn giao — giữ nó cập nhật).

## Phương pháp & độ tin cậy

1. **GitNexus graph** (index của commit nêu trên): liệt kê hàm/class/file không có
   inbound CALLS/ACCESSES/IMPORTS → tạo danh sách nghi vấn.
2. **Scanner kiểm chứng trực tiếp trên working tree** (token-level toàn repo,
   1.275 files / 3.738 exported symbols): đếm mọi tham chiếu tên symbol kể cả
   JSX/type-position, phân biệt test/non-test, resolve import cả alias `@/`.
3. Đã loại false-positive: entry points Next.js (`src/app/**` page/layout/route/
   icon conventions), test files (vitest tự discovery), script chạy tay trong
   `scripts/`, cấu hình root.

**Blind spots còn lại — bắt buộc re-check từng item trước khi xoá:**
dynamic import dựng chuỗi, side-effect import (`import './polyfill'`), tham chiếu
qua string/CSS/runtime reflection. Sau mỗi batch xoá: `npm run typecheck &&
npm test && npm run build`.

---

## A. File chết hoàn toàn — 39 files (không ai import, kể cả test)

### A1. Components (11)
| File | Ghi chú |
|---|---|
| `src/components/JourneySteps.tsx` | |
| `src/components/animated-favicon.tsx` | |
| `src/components/landing/home/home-landing.tsx` | |
| `src/components/match-badge.tsx` | `docs/current-status.md` nhắc như pattern reference — xoá thì sửa doc |
| `src/components/mentorship/MentorCard.tsx` | |
| `src/components/onboarding/onboarding-globe-quiz.tsx` | globe quiz cũ |
| `src/components/onboarding/onboarding-single-page.tsx` | |
| `src/components/statement/StatementFeedbackModal.tsx` | |
| `src/components/statement/is-statement-task.ts` | |
| `src/components/upgrade-prompt-modal.tsx` | |
| `src/components/course-result-card.tsx` | ⚠️ chỉ còn test của nó import → xoá cùng `__tests__/course-result-card.test.tsx` |

### A2. Barrel files không ai mở (19)
`index.ts` dưới đây đều 0 inbound import:
- `src/components/ui/index.ts`
- `src/features/apply/index.ts`
- `src/features/auth/{index,api/index,domain/index,hooks/index,ui/index}.ts` (5)
- `src/features/mentorship/{index,api/index,domain/index,hooks/index,ui/index}.ts` (5)
- `src/features/onboarding/{hooks/index,ui/index}.ts` (2)
- `src/features/scholarships/{index,domain/index,hooks/index,ui/index}.ts` (4)
- `src/features/universities/{index,hooks/index}.ts` (2)
- `src/shared/tokens/index.ts`, `src/shared/types/index.ts`

### A3. Lib modules mồ côi (7)
| File | Ghi chú |
|---|---|
| `src/lib/achievers.ts` | cụm achiever/booking cũ |
| `src/lib/bookings.ts` | cùng cụm trên |
| `src/lib/course-search/search-keywords.ts` | |
| `src/lib/error-logging/error-logger.ts` | module tự gọi nội bộ, không ai import vào |
| `src/lib/explorer-context.tsx` | đã thay bằng `features/universities/ui/explorer-context.tsx` |
| `src/lib/partial-data-helper.ts` | |
| `src/lib/university-utils.ts` | |

### A4. Domain chỉ còn test ôm (dead pair)
- `src/features/universities/domain/university-matching.ts` + `.test.ts` — logic matching đã thay bằng `match-university`/loader mới.

---

## B. Export chết trong file còn sống — ~67 symbols

### B1. Icons không dùng (14)
- `src/components/icons.tsx`: `PiggyBankIcon, TrendingUpIcon, UniversityIcon, BuildingIcon, ToolIcon, PercentIcon, TrophyIcon, CampusIcon, GlobeMiniIcon`
- `src/components/mentorship/mentor-icons.tsx`: `MapPinIcon, CalendarIcon, ChevronIcon, GraduationCapIcon, ClockIcon`

### B2. Legacy matching/admission-fit (⚠️ đọc kỹ trước khi xoá)
- `src/lib/admission-fit.ts`: `classifyAdmissionFit`, `computeProfileStrength`, `ADMISSION_CATEGORY_META`
- `src/lib/matching.ts`: `computeMatchScore`
- `src/lib/match-insights.ts`: `pillarWeightPercent`, `projectPillars`, `ContentBlockType`

> `ADMISSION_FIT_FEATURE.md` (root) vẫn mô tả các hàm này là core — **doc đã lỗi
> thời**, logic thật nằm ở `features/universities/domain/match-university*`.
> Khi clean: xoá code + xoá/sửa doc đó + sửa dòng tương ứng trong `CLAUDE.md`.

### B3. Residue cụm mentorship/booking cũ trong file sống (16)
- `src/lib/mentors.ts`: `getMentorAllSlots`, `getMentorReviews`
- `src/lib/types.ts`: `ScholarshipUniversity, UserUniversity, PersonalStatement, AmbassadorVisit, AmbassadorReferral, LoginEvent`
- `src/lib/apply-types.ts`: `ApplicationOverview, UpcomingDeadline, ShortlistedUniversity, SavedScholarshipLite`
- `src/types/achievers.ts`: `SessionReview, AchieverApplicationInput`
- `src/types/mentorship.ts`: `MentorshipBookingWithMentor, MentorReview`

### B4. Job queue / ingestion (6)
- `src/lib/course-parser/job-queue.ts`: `createParseJobsForApplications, getJobByApplicationId, getPendingJobsCount`
- `src/lib/ingestion/ingestion-job-queue.ts`: `getIngestionJobByApplicationId, updateIngestionJobProgress, markJobComplete`

### B5. Misc lib/server (15)
- `entitlement-service.ts`: `formatRemainingUsage`, `getPlanLimits`
- `payments/manual.ts`: `MANUAL_PROVIDER`, `ManualProduct`
- `search-providers/index.ts`: `getAvailableProviders`, `logProviderHealthWarnings`
- `selection-cache.ts`: `getCompareIds`, `setCompareIds`
- `geo-cms.ts`: `GEO_LINK_RELATIONS`; `wiki-images.ts`: `resolveWikiImages`
- `emails/lifecycle.ts`: `contactConfirmationEmail` (template không ai gửi)
- `server/observability/index.ts`: `LogLevel`
- `plus.ts`: `PLAN_COLUMNS`; `scholarships.ts`: `ScholarshipInput`; `onboarding-options.ts`: `campusStyles`

### B6. AI layer types/helpers (9)
- `ai/cv-builder.ts`: `GeneratedBullet`, `CvBuilderDraftV1`, `CvBuilderDraftV2`
- `ai/lor.ts`: `LorReviewModel`; `ai/strategy/call.ts`: `asScore`
- `analytics/track.ts`: `EventMetadataValue`
- `apply/domain/ai-reports.ts`: `fitDimensionKeySchema`
- `api/planning-context-source-parsers.ts`: `asPillarKey`
- `apply/ui/achievement-cards.tsx`: `CardAction`

---

## C. Export chỉ còn test gọi — quyết định giữ/xoá theo từng case (22)

Bình thường (test hook/tooling cố ý): `setScholarshipQueries`, `setProgrammeQueries`,
`clearPlusStatusCache`, `findMissingStaticKeys`, `routeFromPageFile`,
`BASELINE_TASK_COUNT`, page-smoke exports (`ApplyPage`, `UniversitiesPage`,
`ScholarshipsPage`, `OnboardingPage`, `StrategyHomePage`…), `isCvTask`, `isLorTask`.

**Đáng điều tra trước khi clean:**
- `renderManualStudentEmail` — template email chuyển khoản cho học viên **chưa
  được nối vào luồng production nào** (chỉ test gọi); kèm `fetchConfiguredQrAttachment`
  (B5) cũng mồ côi. → Hỏi owner: thiếu feature hay đã bỏ?
- `runVinUniEvaluation` (14 test refs) — API core chỉ được exercise bởi test?
- `measureAsync`, `mapIngestionResultToApplication`, `recordIngestionJobFailure`,
  `brandManualPaymentSender` — công cụ đo/log mà production không gọi?

---

## D. Over-export (246 symbols dùng đúng 1 file — chỉ bỏ keyword `export`)

Ưu tiên thấp, làm sau khi A–C sạch. Đặc biệt: `redactSensitiveData`, `LifecycleStage`,
`TelemetryOutcome/Operation`, `logError` (`observability`), `getMentorById`
(`mentors.ts`), `getMissingFields` (`partial-data-helper`), `VnpayParams`,
`NationalityEntry`. Danh sách đầy đủ nằm trong kết quả scan phiên 2026-08-22;
khi làm batch D chạy lại scanner để lấy list tươi.

---

## Thứ tự đề xuất cho phiên clean

1. **Batch 1 — barrel files (A2)**: rủi ro thấp nhất. Typecheck + test + build.
2. **Batch 2 — components + pairs (A1, A4)**: nhớ xoá test đi kèm; sửa doc nhắc
   `match-badge`.
3. **Batch 3 — lib mồ côi (A3)**: `explorer-context` cũ dễ nhầm với bản mới —
   kiểm tra đường dẫn kỹ.
4. **Batch 4 — icons + misc exports (B1, B4–B6)**.
5. **Batch 5 — B2 legacy admission/matching**: kèm sửa `ADMISSION_FIT_FEATURE.md`
   + `CLAUDE.md` (đoạn "Tier admission encode bởi `src/lib/admission-fit.ts`").
6. Riêng mục **C-đáng-điều-tra**: hỏi owner trước khi động vào payment email /
   vinuni evaluation.

Mỗi batch = 1 PR, gate `npm run verify:pr`.
