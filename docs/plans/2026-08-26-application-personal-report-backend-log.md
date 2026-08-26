# Implementation log — Application-level Personal Report Backend

> Log thực thi theo `docs/plans/2026-08-26-application-personal-report-backend.md`.
> Cập nhật sau mỗi task để phục vụ review. Migration SQL **không chạy tự động** —
> owner sẽ tự chạy file `.sql` trên production (theo yêu cầu 2026-08-26).

## Tiền kiểm (pre-flight)

- Đọc plan + `docs/README.md` router + `current-status.md` (phần Personal Report).
- Đã xác minh các giả định của plan khớp codebase:
  - `student_personal_report_versions` append-only tồn tại (`supabase-personal-report-versions.sql`), chưa có `application_id`.
  - `confirmed_candidate_snapshots` đã có `application_id` nullable (`supabase-per-application-onboarding.sql`) — FK hiện là `ON DELETE SET NULL`.
  - `course_applications.candidate_confirmed_at` đã có.
  - `catalog_programmes` là **VIEW** trên `courses` (`programme_id == courses.id`) → FK trong migration trỏ về `public.courses`, không phải view.
  - Các file repo/generation/context đúng như plan liệt kê.
- Lưu ý môi trường: pre-flight ban đầu chưa có `SUPABASE_SERVICE_ROLE_KEY`, nên migration chưa thể kiểm tra live ở thời điểm đó. Sau khi owner chạy migration, read-only schema verification ngày 2026-08-26 dùng service role đã xác nhận đủ 7 bảng/cột mới; không thực hiện ghi/xóa dữ liệu.

---

## Task 1: application-scoped persistence & lineage

**Trạng thái:** DONE

### Step 1–2: Test failing trước ✅

Thêm 11 test mới vào `personal-report-v2-repository.test.ts`:

- `getLatestApplicationPersonalReportV2`: filter user_id+application_id; loại row legacy NULL; map lineage; null khi chưa có; degrade migrationMissing.
- `listApplicationPersonalReportV2Versions`: filter cả 2 cột, newest first.
- `getApplicationPersonalReportV2Version`: 3 filter (id/user/app) — report app B không thể trả qua app A.
- `createPersonalReportV2Version`: insert đủ lineage columns.
- `findPersonalReportV2ByCacheKey`: cùng cache key ⇒ cùng row; insert thua race unique (23505) resolve về row đã có thay vì fail.

Kết quả chạy: **FAIL như kỳ vọng** — `11 failed | 14 passed` ("function is not a function", thiếu export).

### Step 3: File migration `supabase-application-personal-report-state.sql` ✅ (đã verify live)

- ALTER `student_personal_report_versions`: +`application_id` (FK cascade), `confirmed_snapshot_id`, `source_analysis_version_id`, `report_contract_version`, `cache_key`; index `(application_id, created_at DESC)`; unique partial `(application_id, cache_key) WHERE NOT NULL`.
- ALTER `confirmed_candidate_snapshots`: +`payload_hash`, `supersedes_snapshot_id`; index `(application_id, confirmed_at DESC)`.
- Tạo 5 bảng append-only RLS owner-only: `programme_target_profile_versions`, `application_profile_analysis_versions`, `application_academic_assessment_versions`, `student_activity_follow_up_answers`, `application_personal_report_supplements`.
- Không backfill/sửa row cũ nào — row cũ giữ `application_id IS NULL` làm archive.

**Quyết định thiết kế (deviation nhẹ khỏi plan, cần review):**
1. `programme_target_profile_versions.programme_id` FK → `public.courses(id)` vì `catalog_programmes` là view (không FK được lên view).
2. `student_activity_follow_up_answers.activity_id` FK → `student_activities(id)` (route Task 6 chỉ có `/activities/[activityId]/follow-up`); achievements follow-up chưa trong scope route.
3. Thêm CHECK `round BETWEEN 1 AND 2` + `superseded_by_answer_id` self-FK cho luật 2 attempts / superseding answers của Task 6.
4. `application_personal_report_supplements` UNIQUE `(user_id, application_id, field_key)` cho upsert idempotent.
5. Legacy global table `personal_report_supplements` giữ nguyên, không đụng đến.

### Step 4: Repository contracts ✅

- Type mới `ApplicationReportScope { userId, applicationId }`.
- `PersonalReportV2Record` +5 field nullable (DB truth — legacy row vẫn đọc được qua reader cũ).
- Type thu hẹp `ApplicationPersonalReportV2Record` — reader ứng dụng **từ chối** row thiếu lineage thay vì fallback (đúng ràng buộc "never fall back to legacy global row").
- Reader mới: `getLatestApplicationPersonalReportV2`, `listApplicationPersonalReportV2Versions`, `getApplicationPersonalReportV2Version`, `findPersonalReportV2ByCacheKey`.
- `createPersonalReportV2Version`: nhận lineage optional (giữ compile xanh cho caller cũ — orchestrator sẽ được bắt buộc truyền đủ ở Task 8); bắt lỗi 23505 cache-key → resolve về row thắng race.
- Giữ nguyên các reader global cũ làm archive read-only.

### Step 5: chạy lại test ✅

- `npm test -- personal-report-v2-repository.test.ts` → **25/25 PASS**.
- `npm run typecheck` → PASS. Fix kèm theo: `personal-report-generation.ts:207` dựng record literal thiếu 5 field mới → bổ sung `null` (path legacy global vẫn ghi archive row, lineage sẽ đến ở Task 8).
- Sửa 1 lỗi mock trong chính test mới viết (`queryRecorder` không trả data/error khi await sau `.order()`) — không phải lỗi production code.

### Step 6: Commit ✅

`feat: add application personal report persistence` — gồm migration SQL + repository + test + type fix generation.

**Trạng thái:** DONE (owner đã chạy migration; schema live đã được kiểm tra read-only)

---

## Task 2: Shared structured AI runtime

**Trạng thái:** DONE

### Step 1–2: Test failing trước ✅

`src/lib/ai/runtime/structured-generation.test.ts` — 8 test: parse JSON qua Zod; đúng 1 lần repair; fail sau lần thứ 2 (không attempt thứ 3, không persist); phân loại `json` vs `schema_validation`; `provider` không được retry; timeout theo budget nội bộ (abort signal); cộng dồn token usage; **không bao giờ log prompt/evidence** (spy console với marker).

Chạy lần đầu: FAIL ("no tests" — module chưa tồn tại).

### Step 3–4: Implement ✅

- `src/lib/ai/runtime/structured-generation.ts`: `generateStructured<T>` + `StructuredGenerationError { kind: provider|timeout|json|schema_validation }`. Dùng singleton `getOpenAIClient()` mặc định, inject `client` chỉ cho test. Budget abort nội bộ mặc định **55s** (một AbortController chung cho cả primary+repair). Trả metadata đầy đủ (model, promptVersion, schemaVersion, attemptCount, repaired, latencyMs, usage).
- `src/lib/ai/runtime/ai-module.ts`: interface `AIModule<I,O>` + `ValidationResult`, `AIContext`, `ApplicantAIState` (placeholder `Record<string,unknown>` cho các domain Task 4–7 sẽ thay bằng type thật), `StateMetadata`.
- Log an toàn: chỉ ghi moduleId/promptVersion/schemaVersion/attempts/repaired/latencyMs/totalTokens — không bao gồm nội dung prompt/output.

### Step 5: Prompt registry ✅

- `src/lib/ai/runtime/prompt-registry.ts` chứa nguyên văn 4 prompt + version: `cmcaitf-v1`, `competency-v1`, `narrative-activity-v1`, `report-synthesis-v1`.
- Sửa 4 file import từ registry, xoá const cục bộ: `evaluation/cmcaitf-extraction.ts`, `evaluation/competency-extraction.ts`, `evaluation/narrative-activity-extraction.ts`, `personal-report-narrative-synthesis.ts`.

### Step 6: Verify ✅

- `npm test -- structured-generation.test.ts server/observability/index.test.ts evaluation` → **53/53 PASS**.
- Kèm narrative-synthesis + personal-report-generation test → **18/18 PASS**.
- `npm run typecheck` PASS (fix 3 lỗi TS nhỏ trong runtime: type param cho Zod issue, holder object cho usage, import ZodError).

### Step 7: Commit ✅

`feat: add structured ai module runtime`.

**Ghi chú review:**
- Plan ghi "Modify openai-client.ts" nhưng không cần sửa gì — singleton dùng trực tiếp. Không thêm provider thứ hai (đúng ràng buộc milestone).
- `ApplicantAIState` hiện là placeholder kiểu rộng; Task 5 sẽ định nghĩa domain thật ở `applicant-state/domain.ts` và thu hẹp lại.

---

## Task 3: Application snapshot revisions (reopen + re-confirm)

**Trạng thái:** DONE

### Step 1–2: Test failing ✅

- File mới `src/app/api/applications/[id]/candidate-information/reopen/route.test.ts` — 5 test: 401; 404 + không ghi gì khi app không thuộc user (B không thể reopen A); chỉ xoá đúng `candidate_confirmed_at`, giữ nguyên review timestamps; không đụng/xoá snapshot & report; 500 khi update lỗi.
- Thêm describe `snapshot revisions` vào confirm route.test.ts — 3 test: re-confirm sau reopen chèn row schema v2 có `payload_hash` (64-hex) + `supersedes_snapshot_id` trỏ snapshot trước của CÙNG app; confirm app A không đụng lineage app khác; lần đầu confirm không có supersedes.
- Kết quả ban đầu: confirm 3 FAIL / reopen 5 FAIL — đúng kỳ vọng.

### Step 3: Route reopen ✅

`POST /api/applications/[id]/candidate-information/reopen`: auth → ownership select (404 trước mọi write) → update CHỈ `candidate_confirmed_at = null` (eq id + user_id) → trả `{status:'reopened'}`. Review timestamps giữ nguyên; snapshot/report không bị động đến.

### Step 4: Snapshot schema v2 ✅

- `candidateSnapshotPayloadSchema` thêm optional `followUpAnswers[]` (activityId/dimension/question/answer/round 1..2) — payload cũ vẫn parse được.
- Repository thêm: `loadResolvedFollowUpAnswers()` (chỉ answer chưa supersede, lọc theo applicationId, tolerant migration-missing → []), `canonicalSnapshotPayloadString()` (sort key đệ quy + sort mảng theo id/activityKey để hash deterministic), `hashCandidateSnapshotPayload()` (sha256 hex).
- Payload v2 hiện chứa đủ: profile+grades/goals, achievements+activities (kèm reflection + reflection_card qua loader sẵn có), 7 personal_reflection_answers (nằm trong profile), documents. Follow-up answers được freeze lúc confirm.

### Step 5: Confirm idempotency mới ✅

- Still-confirmed → trả latest snapshot như cũ.
- Reopened (confirmedAt null) → lookup previous snapshot CỦA APP đó → insert row mới `schema_version:2` + `payload_hash` + `supersedes_snapshot_id` → CHỈ SAU đó mới set `candidate_confirmed_at`.
- Insert retry theo missing-column: parse tên column từ error (`column "x" does not exist`) rồi drop đúng các column đó (supersedes/payload_hash/application_id) — giữ nguyên hành vi tolerant cũ (test legacy vẫn mong đúng 2 attempt).

### Step 6: Verify ✅

- confirm route.test.ts **14/14 PASS**; reopen route.test.ts **5/5 PASS**; features/apply/api **31 test PASS** (tổng 50).
- `npm run typecheck` PASS.

### Step 7: Commit ✅

`feat: support application candidate snapshot revisions`.

**Ghi chú review:**
- Loader follow-up bắt cả exception đồng bộ từ mock/DB nên không bao giờ chặn confirm.
- Hash dùng Node `crypto` trong repository (server-only) — không import vào domain client-side.

---

## Task 4: Target Profile generation từ catalogue đã ingest

**Trạng thái:** DONE

### Step 1–2: Test failing ✅

Thêm file `domain.test.ts` (6 test: fingerprint ổn định theo thứ tự row; đổi content → đổi fingerprint; schema đòi sourceRefs XOR missingInformation; chặn requirement thiếu cả hai; không có khái niệm admission-probability trong type) và `generation.test.ts` (6 test) + `route.test.ts` (6 test). Ban đầu: domain 5 FAIL, generation 5 FAIL, route 6 FAIL.

### Step 3–5: Implement ✅

- `domain.ts`: `targetProfileSchema` (programme/universityValues/themes/requirements theo category academic|competency|selection|scholarship|application/deadlines/missingInformation/sources) + refinement bắt buộc "sources hoặc missing information"; `canonicalSourceFingerprint()` — canonical JSON sort key đệ quy + composite stableKey.
- `repository.ts`: `loadProgrammeCatalogue` đọc CHỈ bảng đã ingest (`courses`, `course_admission_requirements`, `course_field_values`, `crawl_sources` bounded per-run); `getLatestTargetProfileVersion`; `createTargetProfileVersion`. Không có code path fetch URL nào → "never crawls" đúng về mặt cấu trúc.
- `generation.ts`: `resolveTargetProfile` — deterministic-first map admission rows/field values; prose còn lại đi qua `generateStructured` với prompt mới `target_profile_extraction` (registry v1). Trả `cached | stale(regen) | ready(first) | not_ready`. Stale = fingerprint mismatch, KHÔNG phải tuổi retrieval.
- Route `POST /api/ai/target-profiles`: zod `{programmeId uuid, scholarshipKey?}`; not_ready→409; các status khác 200 kèm versionId+profile.
- Registry thêm entry `target_profile_extraction`.

### Step 6: Verify ✅

26/26 PASS (domain 6 + generation 6 + route 6 + runtime regression 8). `npm run typecheck` PASS. Fix dọc đường: z.object wrap cho programme/themes trong schema; composite stableKey cho fingerprint; mock harness seed thiếu `profile`; toRows helper dùng làm onFulfilled của PostgrestBuilder.

### Step 7: Commit ✅

`feat: add reusable target profile generation`.

---

## Task 5: ApplicantAIState application-scoped + Academic analysis

**Trạng thái:** DONE (commit `bc6697b`)

- `applicant-state/domain.ts`: `ApplicantAIState` thật (extends base runtime, thu hẹp member types) + `AcademicRecord/AcademicProfile/IdentitySignals/DirectionSignals`. Base `ai-module.ts` nới member thành `unknown[]` để interface extension hợp lệ.
- `context-builder.ts`: **snapshot-only** — duy nhất 1 query vào `confirmed_candidate_snapshots` (filter user+app+id), mọi bảng khác không thể bị chạm → "edit live data sau snapshot A không đổi state A" đúng về cấu trúc; converter pure `stateFromSnapshotRow`; lỗi ownership → `SnapshotNotFoundError`.
- `academic-analysis.ts`: 4 verdict `meets | possibly_meets | does_not_meet | insufficient_information`; IELTS/TOEFL/SAT/ACT coi như fixed-scale (so sánh trực tiếp); GPA cần khớp scale — thiếu scale ⇒ insufficient (không bao giờ 0/fail); khác hệ grading có giá trị ⇒ possibly_meets; KHÔNG có khái niệm probability.
- `application-analysis-repository.ts`: append-only writes cho `application_profile_analysis_versions` + `application_academic_assessment_versions`, tolerant migration-missing.
- Tests: context-builder 3 + academic 5 = **8/8 PASS**, typecheck PASS.

**Deviation ghi nhận:** để test "state từ snapshot" đầy đủ, payload v2 cần chứa điểm thi — nhưng Task 3 chưa đưa `academicRecords` vào snapshot. Đã bổ sung: schema confirm thêm optional `academicRecords[]`, confirm route freeze kèm (loader tolerant). Chi tiết sẽ hoàn thiện ở Task 8 khi generation đọc snapshot.

---

## Task 6: Experience / Reflection / Adaptive Follow-up analysis

**Trạng thái:** DONE

### Regression Q1–Q7 ✅

- `reflection-analysis.ts`: bảng dimension q1→interests_motivations … q7→environment_preference (type đặt tại `shared/evaluation/engine.ts` — giữ hướng dependency shared←lib, lib re-export); `deriveReflectionSignals` + `analyzeReflectionAnswers` với luật **≥2 nguồn độc lập mới là `repeated`**, 1 câu trả lời đơn lẻ chỉ là `isolated` (corroboration bằng keyword-overlap ≥2 token với free text hoạt động).
- `personal-report-v2.ts` `buildProfileEvaluationInput` giờ đọc `profile.personal_reflection_answers`: signals đi vào input mới `reflectionAnswerSignals` (field OPTIONAL additive trong ProfileEvaluationInput), đồng thời 7 câu trả lời gia nhập `writtenFields` (F6 chấm vagueness) và các câu mang tính motivation/direction gia nhập `profileMotivations`. Hash input thay đổi khi bất kỳ câu nào đổi.
- Tests: it.each 7 question key + pipeline-tolerance — PASS.

### Adaptive Follow-up ✅

- `adaptive-follow-up.ts`: priority ladder `action > ownership > impact > transformation > challenge > motivation > context`; **1 câu/response**; cap 2 attempts/dimension & 6/activity; `preferDimension` là con đường DUY NHẤT để hỏi lại cùng dimension (round 2); AI chỉ phrase qua `generateStructured` — fail ⇒ template fallback; `recordFollowUpAnswer.validateTarget` chặn stale question, `append` ghi supersede kiểu append-only.
- Route `POST /api/applications/[id]/activities/[activityId]/follow-up`: auth → ownership app + activity → **409 nếu application đã confirmed** (phải reopen) → action=question|answer; answer enforce lại limits server-side (409 STALE_QUESTION khi round không khớp), insert append-only, tolerant migration (503).
- Tests: adaptive-follow-up 9 + reflection-analysis 5 + personal-report-v2 pipeline 14 = **28/28 PASS**; typecheck PASS.

**Ghi chú review:**
1. Engine `ProfileEvaluationInput` thêm field optional `reflectionAnswerSignals` — additive, engine hiện chưa tiêu thụ trực tiếp (F4 vẫn chạy như cũ); tiêu thụ sâu hơn thuộc Task 8.
2. Route follow-up validate "stale" bằng giới hạn cứng (đếm attempts/round phải khớp) chứ chưa lưu ask-session; đủ cho M0, có thể nâng cấp sau.
3. Plan liệt kê test file `reflection-analysis.test.ts` — đã tạo đúng; phần wiring pipeline nằm trong personal-report-v2.test.ts.

### Commit ✅

`feat: add reflection and adaptive evidence analysis`

---

# BATCH 2 HOÀN TẤT — chờ review

| Task | Commit | Tests |
|---|---|---|
| 4 Target Profile | `22666e9` | 12 (domain+generation) + 6 route |
| 5 State + Academic | `bc6697b` | 8 |
| 6 Reflection/Follow-up | (vừa commit) | 28 |

Tổng cộng dồn: typecheck PASS toàn repo sau mỗi task. Chưa đụng UI/Matching/Strategy (Task 10–11). Migration Personal Report đã được owner chạy; phần RLS cross-user vẫn cần kiểm thử bằng hai tài khoản authenticated trên non-production.

---

## Task 7 — Evidence Bank & provenance validation ✅

- `src/shared/evidence/domain.ts`: `EvidenceSource` / `AIInterpretation` / `EvidenceClaim` (category, statement, normalizedValue?, status verified|unverified|conflicting|report_only, sourceRefs[], interpretationRefs[], tags) / `EvidenceBank`.
- `build-evidence-bank.ts`: builder deterministic thuần từ ApplicantAIState:
  - Merge duplicate theo **khóa ngữ nghĩa** `metric|value|scale` (không phải id nguồn) → 2 bản ghi IELTS 7.0 gộp 1 claim giữ cả hai sourceRefs.
  - Cùng metric khác giá trị ⇒ **cả hai** `conflicting` + missingInformation area chứa 'conflict'.
  - Claim gốc từ AI (`interpretationRefs` có id) **không bao giờ** được verify cấu trúc: interpretation id không bao giờ xuất hiện trong `sourceRefs`; competency claim sinh từ `payload.label` luôn `unverified`, `sourceRefs: []`.
  - Verify deterministic duy nhất: achievement có evidence document khớp; english/standardized test có giá trị chuẩn hóa; supplement = `report_only`.
  - Input `interpretations[].origin` được chuẩn hóa `ai_extraction` khi lưu.
- `retrieval.ts`: `lookupBySource` / `lookupByCompetency` / `lookupByCriterion`.
- Tests 9/9 PASS (tách collection sources vs interpretations, merge, conflict, verify rules, retrieval); typecheck PASS.

### Commit ✅

`feat: add grounded evidence bank` (`9d87b9b`)

---

## REVIEW ROUND 1 — feedback owner (2026-08-26)

Kết luận kiểm chứng từng điểm (có đúng/sai đều ghi rõ):

### P0-1 Target Profile cache luôn miss — **ĐÚNG, đã sửa**
- Bảng migration chỉ có `created_by`; repo đọc `.eq('user_id')` ⇒ 42703 bị `isSchemaGap()` nuốt thành cache miss vĩnh viễn. RLS select_own chặn đọc chéo user, trái mục tiêu cache programme-level.
- Fix: `repository.ts` bỏ filter user ở read (profile chỉ chứa dữ liệu catalogue, không personal data; `userId` giữ lại để đối xứng chữ ký/log); thêm `console.warn` khi schema gap để mismatch không bao giờ nuốt lặng lần nữa. Migration đổi policy SELECT thành `select_authenticated USING (true)` (INSERT vẫn own). File SQL sửa trực tiếp vì chưa chạy ở đâu.
- Test: fake chain cứng `eq→eq→is` trong generation.test.ts cập nhật thành `eq→is` theo chuỗi mới.

### P0-2 Abort signal truyền vào body — **ĐÚNG, đã sửa**
- SDK OpenAI nhận signal ở đối số options thứ 2; code cũ nhét `signal` vào body ⇒ budget 55s không abort request thật, provider còn có thể từ chối field lạ.
- Fix: `StructuredProviderClient.create(body, options?)` — signal chuyển sang `{ signal }` options; type bỏ signal khỏi body. Thêm assertion hồi quy: body **không** chứa key `signal`, `options.signal instanceof AbortSignal`; test timeout đọc signal từ tham số thứ 2.

### P0-3 Route follow-up chọn cột không tồn tại — **ĐÚNG, đã sửa**
- Route select `question_id_fallback` nhưng bảng không có cột đó ⇒ 42703 coi là migration-missing ⇒ existingAnswers rỗng, mọi cap/round vô hiệu.
- Fix: select đúng `'id, dimension, question, answer, round'`.

### P1-1 Stale question / supersede dở dang — **ĐÚNG, đã sửa**
- Trước đây: `askedQuestions: []` cứng; client gửi question text tùy ý; `void recordFollowUpAnswer` — trong khi snapshot loader lọc `superseded_by_answer_id IS NULL` mà cột không bao giờ được ghi ⇒ round cũ leak vào snapshot.
- Fix: (a) build `askedQuestions` từ text câu hỏi đã lưu ⇒ engine không hỏi lại phrasing cũ; (b) guard replay: question text trùng câu đã trả lời (case-insensitive) ⇒ 409 STALE_QUESTION; (c) **ghi supersede thật**: sau insert thành công UPDATE các answer cùng application+activity+dimension đang `superseded_by_answer_id IS NULL` trỏ sang id mới (lỗi update non-fatal, chỉ warn — answer chính vẫn append-only an toàn); bỏ import `recordFollowUpAnswer` không dùng.

### P1-2 Thành tích mất khỏi Evidence Bank — **SAI MỘT PHẦN**
- Achievements ĐÃ được map vào ApplicantAIState (`context-builder.ts:113` `mapItems(reflection['achievements'], 'achievement')`) VÀ ĐÃ được xử lý bởi buildEvidenceBank (vòng lặp achievement riêng; test chứng minh claim `experience:ach-1` verified qua document + source key `achievement:ach-1`). Comment "Activities only" trong context-builder chỉ nói về list `narrativeActivities`.
- Phần ĐÚNG: pipeline report phía sau CHƯA tiêu thụ evidence bank — nhưng đó chính là việc wiring của Task 8 (đang làm tiếp), không phải bug hiện hữu.

### Verification
- Focused: runtime + target-profile + cv + activities = **71/71 PASS**; `npm run typecheck` sạch.
- Full suite: 339/340 file PASS. File fail duy nhất `check-i18n.integration.test.ts` là **lỗi có sẵn trước nhánh này**: thiếu 3 key "Short/Mid/Long Term" (personal-canvas.tsx) trong dictionary từ commit `be53245` (23/08), đồng thời script checker **không deterministic** (hai lần chạy `--all` liên tiếp cho report khác nhau — readdirSync không sort). Owner chỉ thị bỏ qua, tính sau.

### Commit

`fix: apply review corrections to runtime, profiles, follow-ups`

---

## Task 8 — Application-scoped report generation ✅

- Personal Report generation now loads one confirmed application snapshot, grounds the report in its analysis/evidence lineage, validates the 150–200 word contract, and supports cache, force, idempotency, and deterministic fallback behavior.
- Commits: `3c0a5b6`, `5d695de`.
- Verification: focused 71/71 tests, typecheck, scoped ESLint, and production build passed.

## Task 9 — Report history and version routes ✅

- Added application-scoped report history/version reads and API routes.
- Commit: `c952d69`.
- Verification: 6 files/23 tests and typecheck passed.

## Task 10 — Downstream report lineage ✅

- Preserved application and source-report lineage through downstream report generation.
- Commit: `2114eb7`.
- Verification: 2 files/18 tests passed.

## Task 11 — Application-scoped UI and evidence actions ✅

- Passed application context through Personal Report UI, evidence upload, inline actions, and Personal Canvas flows; added stale/read-only and regeneration hardening.
- Commits: `1749ca8`, `a10c294`.
- Verification: focused UI/workspace tests 14/14 and typecheck passed.

## Task 12 — Isolation and concurrency integration coverage ✅

- Added a stateful PostgREST-shaped integration fixture covering snapshot A1/B1 isolation, A2 history, legacy `application_id IS NULL` rows, application-local supplements, exact evidence lineage, and concurrent non-force cache convergence.
- Commit: recorded with this task-log update as `test: verify application personal report isolation`.
- Verification: integration fixture 3/3 passed; report/evaluation/evidence/AI suite 80 files/822 tests passed; typecheck and scoped ESLint passed; production build passed with existing Turbopack filesystem-tracing warnings.
- `npm.cmd run verify:pr` passed in a clean worktree with Node 24.19.0: base and strict TypeScript, ESLint (0 errors/7 warnings), 345 test files with 3276 passing tests/2 todo, coverage, and the production build. Build output retains the existing three `geo-content.ts` filesystem-tracing warnings and non-fatal placeholder-Supabase fetch logs.
- Owner subsequently applied `supabase-application-personal-report-state.sql` to the configured Supabase project. Read-only verification confirmed all 7 new tables, all required lineage columns/types, and 24 legacy report rows retaining `application_id = NULL`; no production writes were made by the verification. Cross-user RLS behavior on a non-production project remains unverified because no such environment is configured.
- GitNexus was refreshed with `gitnexus analyze` at `dac508e`; explicit impact review found the shared report orchestrator high-risk/critical by graph fan-out (95 impacted symbols, 13 processes) and the canonical POST route critical (38 impacted symbols, 27 processes). Existing uncommitted Matching Report UI changes were kept out of this task commit.
