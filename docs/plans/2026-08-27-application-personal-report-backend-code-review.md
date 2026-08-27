# Code review: Application-level Personal Report backend

**Ngày review:** 2026-08-27
**Tài liệu đối chiếu:** `2026-08-26-application-personal-report-backend.md` và `2026-08-26-application-personal-report-backend-log.md`
**Code được review:** working tree tại `main` / HEAD `0f8e01c` (working tree đã có thay đổi của người dùng trước khi review)
**Kết luận:** Đã có implementation thật cho Tasks 1–13, nhưng chưa thể coi là hoàn tất. Review tìm thấy **14 lỗi P1** và **5 lỗi P2**. Không phát hiện P0 đã được chứng minh.

Review này chỉ ghi lỗi; không sửa source code.

## Mức độ hoàn thành so với plan/log

| Task | Kết quả review |
|---|---|
| 1. Application-scoped persistence & lineage | **Một phần.** Reader application có filter đúng, nhưng reader “legacy archive” đang trộn report của application; write API trung tâm vẫn cho phép ghi row global/lineage thiếu. |
| 2. AI module runtime | **Đã có.** Không tìm thấy lỗi blocking trong phạm vi review này. |
| 3. Snapshot revisions | **Một phần.** Reopen/re-confirm đã có nhưng confirm không atomic, có fallback sai scope và có thể bỏ cột lineage bắt buộc. |
| 4. Target Profile | **Một phần.** Generation/cache đã có, nhưng fingerprint phụ thuộc retrieval timestamp và chưa canonical hoàn toàn. |
| 5. ApplicantAIState & Academic analysis | **Một phần.** Analyzer được Matching dùng, nhưng persistence `application_academic_assessment_versions` chưa được nối vào production flow. |
| 6. Reflection & adaptive follow-up | **Một phần.** Có mapping/signals và route, nhưng Q1–Q7 chưa thực sự đi vào deterministic Identity/Direction; stale/concurrency/supersede chưa an toàn. |
| 7. Evidence Bank | **Một phần.** Có model/retrieval/provenance, nhưng rule document-backed có thể xác minh nhầm achievement bằng tài liệu không liên quan. |
| 8. Application report generation | **Một phần.** Orchestrator application-scoped đã có; queue force/idempotency còn lỗi. |
| 9. APIs/history | **Một phần.** Route đã có, nhưng canonical POST nhận rồi bỏ qua `idempotencyKey`. |
| 10. Matching/Strategy lineage | **Đã có theo hai route được nêu trong plan.** Test hiện hữu pass; tuy nhiên Planner khác vẫn đọc report global (P1-02). |
| 11. UI integration | **Một phần.** UI gửi application context nhưng polling có thể trả ngay report cũ và che lỗi job. |
| 12. Isolation/concurrency | **Chưa đủ.** Fixture hiện hữu pass nhưng không bao phủ các race/fallback bên dưới. RLS cross-user vẫn chưa được xác minh theo chính log. |
| 13. AI narrative + durable queue | **Một phần.** Narrative và queue đã có; lifecycle request còn mất force/idempotency và trả raw internal job. |

## Findings P1

### P1-01 — Reader “legacy archive” trộn report của mọi application

**Bằng chứng**

- `src/features/apply/api/personal-report-v2-repository.ts:134-144`: `getLatestPersonalReportV2` chỉ filter `user_id`, không filter `application_id IS NULL`.
- `src/features/apply/api/personal-report-v2-repository.ts:155-163`: `listPersonalReportV2Versions` có cùng lỗi.
- `src/features/apply/api/personal-report-v2-repository.ts:181-191`: `getPersonalReportV2Version` có cùng lỗi.
- `src/app/ai-strategy/personal-report/page.tsx:61-68` gọi các reader này cho view được mô tả là “read-only legacy archive”.
- `src/app/api/ai-strategy/personal-report/versions/route.ts:20` và `versions/[id]/route.ts:22` cũng dùng các reader này.

**Tình huống lỗi:** User có legacy report L và report mới của application A/B. Trang archive global sẽ hiển thị report application mới nhất, history trộn L/A/B, và API version global có thể mở report application thay vì chỉ archive.

**Ảnh hưởng:** Vi phạm quyết định cố định “legacy rows `application_id IS NULL` là archive”; sai cách ly application và provenance.

**Hướng sửa gốc:** Ba legacy reader phải thêm `application_id IS NULL`; giữ application reader riêng như hiện tại. Thêm test có đồng thời legacy row, app A và app B.

### P1-02 — Planner của application A lấy structured evaluation từ report global mới nhất

**Bằng chứng**

- `src/features/ai-strategy-dashboard/api/fetch-planning-context-sources.ts:500-526` đã có `applicationId` trong flow nhưng dòng 504 gọi `getLatestPersonalReportV2(supabase, userId)`.

**Tình huống lỗi:** Report mới nhất của user thuộc application B; khi tạo Planning context cho application A, `profileEvaluation` và provenance lại lấy từ B.

**Ảnh hưởng:** Cross-application contamination trực tiếp vào Planner; output kế hoạch của A có thể dựa trên phân tích của B.

**Hướng sửa gốc:** Dùng `getLatestApplicationPersonalReportV2({ userId, applicationId })`, yêu cầu lineage đầy đủ và ghi provenance của đúng application. Thêm fixture A/B theo thứ tự thời gian đảo nhau.

### P1-03 — Onboarding gate coi report của application khác/legacy là report của application hiện tại

**Bằng chứng**

- `src/features/ai-strategy-dashboard/api/onboarding-status.ts:83-88`: query `student_personal_report_versions` chỉ filter `user_id`.
- `src/features/ai-strategy-dashboard/api/onboarding-status.ts:115-122`: `hasPersonalReport` từ query trên được dùng để bật `aiAnalysisComplete` cho application đang mở.

**Tình huống lỗi:** A đã có Personal Report, B chỉ có Matching row hoặc legacy analysis; B có thể vượt gate dù chưa có Personal Report application-scoped hợp lệ.

**Ảnh hưởng:** Trạng thái onboarding sai, cho phép user đi tiếp với lineage thiếu/sai application.

**Hướng sửa gốc:** Filter cả `user_id` + `application_id`, tốt hơn là dùng repository application-scoped và kiểm tra lineage/current confirmed snapshot. Thêm test A có report, B không có.

### P1-04 — Confirm với application ID invalid/không sở hữu âm thầm chuyển thành global confirm

**Bằng chứng**

- `src/app/api/candidate-information/confirm/route.ts:68-75`: invalid JSON hoặc body không pass schema bị coi như không truyền `applicationId`.
- `src/features/apply/api/verified-application-id.ts:18-25`: application không tồn tại, không thuộc user, hoặc query lỗi đều trả `undefined`.
- `src/app/api/candidate-information/confirm/route.ts:76` tiếp tục legacy global path khi kết quả là `undefined`.

**Tình huống lỗi:** Client gửi UUID của application khác, UUID không tồn tại, body malformed, hoặc DB ownership lookup lỗi. Route không trả 4xx/5xx mà tạo snapshot global `application_id = NULL` và cập nhật trạng thái global.

**Ảnh hưởng:** Side effect sai scope; caller nhận success giả; canonical application flow mất lineage.

**Hướng sửa gốc:** Phân biệt rõ “body thật sự không có” với “body/application ID invalid”; canonical call phải trả 422 cho invalid, 404/403 cho unowned, 5xx cho lookup lỗi và tuyệt đối không fallback global. Thêm test cho bốn nhánh này.

### P1-05 — Confirm không atomic nên double-click/race tạo snapshot trùng hoặc orphan

**Bằng chứng**

- `src/app/api/candidate-information/confirm/route.ts:85-104`: idempotency check xảy ra trước insert, không có transaction/row lock.
- `src/app/api/candidate-information/confirm/route.ts:216-217`: snapshot insert là câu lệnh riêng.
- `src/app/api/candidate-information/confirm/route.ts:251-264`: application lock update chạy sau insert và lỗi chỉ được log, response vẫn success.
- Migration chỉ có index `(application_id, confirmed_at)`; không có constraint ngăn hai active confirmation cùng revision.

**Tình huống lỗi:** Hai request confirm đồng thời đều thấy `confirmedAt = null`, cùng insert hai snapshot. Hoặc insert thành công nhưng update `candidate_confirmed_at` lỗi; retry tạo thêm snapshot.

**Ảnh hưởng:** Revision chain phân nhánh/trùng, report có thể lấy snapshot không xác định; log tuyên bố double-click idempotent nhưng code chưa đảm bảo.

**Hướng sửa gốc:** Đưa check + insert + application lock vào một DB RPC/transaction, lock row application (`FOR UPDATE`), và trả snapshot hiện hữu nếu đã confirmed. Thêm concurrent integration test và test rollback khi lock update lỗi.

### P1-06 — Application confirm “fail open” bằng cách bỏ cột lineage bắt buộc

**Bằng chứng**

- `src/app/api/candidate-information/confirm/route.ts:185-214`: `DROPPABLE_COLUMNS` gồm `application_id`, `payload_hash`, `supersedes_snapshot_id`; route xóa cột thiếu rồi retry insert.

**Tình huống lỗi:** Deployment chưa có `application_id`; application confirm vẫn tạo snapshot global rồi set application là confirmed. Sau đó application snapshot reader không tìm thấy snapshot và generation bị block. Nếu thiếu hash/supersedes, route vẫn báo success với revision thiếu integrity lineage.

**Ảnh hưởng:** Trạng thái application “confirmed” nhưng không có snapshot hợp lệ; dữ liệu khó phục hồi và trái acceptance criteria.

**Hướng sửa gốc:** Với request có `applicationId`, không được drop bất kỳ cột lineage v2 bắt buộc nào; trả 503 để migration được sửa. Chỉ legacy path thật sự mới được dùng schema cũ. Thêm partial-schema tests.

### P1-07 — Achievement có thể được đánh dấu verified nhờ một document không liên quan

**Bằng chứng**

- `src/shared/evidence/build-evidence-bank.ts:59-62`: document snapshot chỉ có `id` và `fileName`, không có storage/evidence key để match.
- `src/shared/evidence/build-evidence-bank.ts:100-102`: `hasDocumentSource()` chỉ kiểm tra có bất kỳ document nào.
- `src/shared/evidence/build-evidence-bank.ts:245-255`: achievement có `evidenceKey` bất kỳ sẽ verified nếu bank có bất kỳ document.
- `src/shared/evidence/build-evidence-bank.ts:253`: `sourceRefs` cũng không chứa document đã dùng để verify.

**Tình huống lỗi:** Achievement A trỏ tới key không tồn tại; snapshot có document B không liên quan. A vẫn được `verified: true` nhưng provenance chỉ trỏ tới chính activity/achievement.

**Ảnh hưởng:** Claim không được hỗ trợ có thể đi vào Personal Report/Matching dưới trạng thái verified; vi phạm rule “unsupported AI claims never become verified”.

**Hướng sửa gốc:** Freeze stable document storage key/id trong snapshot, match chính xác achievement ↔ document, và thêm document source ID vào `sourceRefs`. Test “missing referenced doc + unrelated doc exists” phải trả `unverified`.

### P1-08 — Stale-question guard không chứng minh câu hỏi đã từng được phát hành và có race

**Bằng chứng**

- `src/app/api/applications/[id]/activities/[activityId]/follow-up/route.ts:36-44`: answer nhận `dimension`, `round`, `question` từ client, không có issued-question ID/token.
- `route.ts:138-160`: action `question` trả câu hỏi nhưng không persist ask/session.
- `route.ts:163-178`: “stale” chỉ nghĩa là text chưa từng có answer và round bằng count + 1; client có thể tự bịa text mới.
- `route.ts:181-193`: check và insert riêng; migration không có unique constraint `(user_id, application_id, activity_id, dimension, round)`.

**Tình huống lỗi:** Client gửi một câu hỏi tự tạo với đúng dimension/round và được chấp nhận. Hai answer đồng thời cho cùng round đều có thể qua count check và cùng insert.

**Ảnh hưởng:** Adaptive follow-up state không đáng tin cậy; vượt stale contract, caps và deterministic snapshot.

**Hướng sửa gốc:** Persist issued question/session hoặc signed nonce, answer bằng ID/token; thêm DB unique constraint và atomic consume/insert. Test forged question, old issued question sau khi phát hành câu mới và concurrent same-round.

### P1-09 — Supersede follow-up không atomic và lỗi update bị bỏ qua

**Bằng chứng**

- `src/app/api/applications/[id]/activities/[activityId]/follow-up/route.ts:181-193`: insert answer mới trước.
- `route.ts:211-231`: update các answer cũ sang `superseded_by_answer_id` là câu lệnh sau; lỗi non-migration chỉ log warning và route vẫn success.
- `src/features/apply/api/candidate-snapshot-repository.ts:373-390`: snapshot loader lấy mọi row `superseded_by_answer_id IS NULL`.

**Tình huống lỗi:** Insert round 2 thành công, update round 1 lỗi. Cả round 1 và 2 đều còn active và cùng bị freeze vào snapshot kế tiếp.

**Ảnh hưởng:** Snapshot không còn deterministic “latest answer wins”; analysis/hash có input mâu thuẫn.

**Hướng sửa gốc:** Insert + supersede trong cùng RPC/transaction; rollback toàn bộ nếu update thất bại. Thêm test injected update failure.

### P1-10 — Q1–Q7 chưa “materially feed Identity/Direction” như plan/log tuyên bố

**Bằng chứng**

- `src/lib/ai/personal-report-v2.ts:462-494`: cả bảy answer vào `writtenFields`; chỉ ba dimension (`interests_motivations`, `academic_direction`, `career_direction`) vào `profileMotivations`; signals được truyền tiếp.
- `src/lib/ai/personal-report-v2.ts:459-460`: `intendedDirection` vẫn chỉ lấy `profile.goals`.
- `src/shared/evaluation/engine.ts:117-164`: engine khai báo `reflectionAnswerSignals` nhưng không đọc field này; Identity chỉ synthesize từ `narrativeActivities`.
- Chính log dòng 208 thừa nhận engine chưa tiêu thụ trực tiếp, trong khi plan dòng 467 yêu cầu thay đổi từng Q1–Q7 phải thay đổi Identity/Direction signal.

**Tình huống lỗi:** Đổi Q2/Q3/Q4/Q7 có thể đổi vagueness/input hash/prompt nhưng không đổi deterministic Identity/Direction output tương ứng.

**Ảnh hưởng:** Task 6/8 và acceptance criteria chưa đạt; deterministic analysis không phản ánh đầy đủ Personal Reflection.

**Hướng sửa gốc:** Tiêu thụ mapping Q1–Q7 trong deterministic Identity/Direction model (hoặc sửa lại contract nếu sản phẩm không còn yêu cầu). Thêm output-level test riêng cho từng Q, không chỉ test signals/hash.

### P1-11 — Academic assessment persistence chỉ là API không có production caller

**Bằng chứng**

- `src/features/apply/api/application-analysis-repository.ts:138-168` định nghĩa `saveApplicationAcademicAssessment`.
- Search production không tìm thấy caller của hàm này.
- `assessAcademicRequirements` được Matching gọi ở `src/lib/ai/matching/aggregation.ts:230`, nhưng kết quả không được version hóa qua `application_academic_assessment_versions` như Task 5/log yêu cầu.

**Tình huống lỗi:** Personal Report/Matching chạy academic checks nhưng không tạo application-scoped academic assessment version gắn snapshot/input hash/module versions.

**Ảnh hưởng:** Không có durable academic lineage để audit/reuse; Task 5 chỉ hoàn thành phần analyzer, chưa hoàn thành persistence flow.

**Hướng sửa gốc:** Nối một production orchestration point duy nhất để persist assessment sau deterministic analysis, dùng snapshot ID/input hash hiện tại và reuse cached version nếu phù hợp. Thêm integration test đọc row đã lưu.

### P1-12 — UI polling dừng ngay trên report cũ khi regeneration còn pending/processing

**Bằng chứng**

- `src/app/api/applications/[id]/personal-report/route.ts:61-70`: GET luôn trả latest report hiện có cùng generation job.
- `src/features/apply/ui/personal-report-v2-view.tsx:153-174`: polling kiểm tra `body.reportV2` trước generation status; thấy report là stop polling.

**Tình huống lỗi:** Application đã có version V1; user force regenerate V2. Poll đầu tiên thấy V1, dừng animation/busy và không chờ V2. Nếu job đang `blocked`, nhánh report cũ cũng che luôn error.

**Ảnh hưởng:** User thấy report stale và tưởng generation xong; lỗi worker không được hiển thị.

**Hướng sửa gốc:** Xử lý generation status trước; chỉ accept report khi job `complete` và `versionId === generation.report_version_id` (hoặc version đổi đúng request). `blocked` phải ưu tiên trước report. Thêm UI tests với existing V1 + processing/blocked job.

### P1-13 — Force request có thể bị mất khi worker đang processing

**Bằng chứng**

- `src/features/apply/api/personal-report-generation-job-queue.ts:68-73`: force request cập nhật `force_requested = true` trên active job.
- `src/app/api/cron/process-personal-report-generation/route.ts:19-24`: worker dùng object đã claim để truyền `job.force_requested` vào orchestrator.
- `personal-report-generation-job-queue.ts:118-128`: completion reset `force_requested = false` mà không kiểm tra có request mới sau claim.

**Tình huống lỗi:** Worker claim normal job với `force_requested=false`; trong lúc chạy user gửi force, DB thành true; worker vẫn chạy non-force theo snapshot cũ rồi completion ghi false. Không còn job/request thứ hai.

**Ảnh hưởng:** User yêu cầu force regeneration nhưng request biến mất; không có retry hay dấu vết.

**Hướng sửa gốc:** Dùng request/generation revision token hoặc enqueue request mới; completion chỉ consume revision đã claim và phải để request mới pending. Thêm race test “force arrives after claim, before complete”.

### P1-14 — Canonical queue API nhận nhưng bỏ qua `idempotencyKey`

**Bằng chứng**

- `src/app/api/applications/[id]/personal-report/route.ts:20-24` parse `idempotencyKey`.
- `route.ts:118-123` enqueue nhưng không truyền key.
- `src/features/apply/api/personal-report-generation-job-queue.ts:62-65` không có argument/storage cho key.
- `src/features/apply/ui/personal-report-v2-view.tsx:115-123` gửi UUID nhưng server không dùng.

**Tình huống lỗi:** Hai force request với cùng idempotency key, đặc biệt request thứ hai đến sau job trước đã complete, có thể tạo hai report versions/AI calls.

**Ảnh hưởng:** Vi phạm contract Task 8/9/11; tốn chi phí và history có duplicate semantic request.

**Hướng sửa gốc:** Persist request key/cache key trên durable job hoặc request table; enforce unique theo user/application/key và truyền key tới orchestrator. Test cùng key cả khi job active lẫn sau complete.

## Findings P2

### P2-01 — Target Profile fingerprint đổi chỉ vì retrieval timestamp đổi

**Bằng chứng**

- `src/lib/ai/target-profile/domain.ts:99-105` đưa `retrievedAt` vào source projection.
- `domain.ts:141-148` hash toàn bộ sources.
- `domain.ts:151-159` còn đưa `retrieved_at` của field value vào identity material.

**Tình huống lỗi:** Catalogue được fetch lại với nội dung/content hash y hệt nhưng timestamp mới; fingerprint đổi và Target Profile bị coi stale/regenerate.

**Ảnh hưởng:** AI call/version thừa; trái quyết định “stale do content fingerprint, không do retrieval age”.

**Hướng sửa gốc:** Loại retrieval timestamps khỏi hash; hash content hash + semantic source identity/value. Test cùng content nhưng timestamps khác phải cho cùng fingerprint.

### P2-02 — Canonical array sort không có tie-break toàn phần

**Bằng chứng**

- `src/lib/ai/target-profile/domain.ts:112-137`: comparator chỉ dùng vài identity fields; hai row có cùng/không có key trả comparator 0, nên stable sort giữ input order dù payload khác.

**Tình huống lỗi:** Hai admission/field rows có cùng `course_id`/`document_type` nhưng value khác; đảo thứ tự input có thể đổi fingerprint.

**Ảnh hưởng:** Cache key không thật sự độc lập với row ordering như comment/plan tuyên bố.

**Hướng sửa gốc:** Sau identity key, tie-break bằng canonical JSON của toàn row. Thêm duplicate-key reorder test.

### P2-03 — Write invariant trung tâm vẫn cho phép tạo global report hoặc partial lineage

**Bằng chứng**

- `src/features/apply/api/personal-report-v2-repository.ts:421-458`: toàn bộ lineage args optional và chỉ insert field có giá trị.
- `src/features/apply/api/personal-report-generation.ts:478-486` vẫn có nhánh `regenerateLegacyPersonalReport` khi thiếu `applicationId`.
- Public routes hiện tại đều truyền application ID, nên đây chưa phải runtime exploit từ route; nhưng invariant nằm ở caller thay vì writer/DB.

**Ảnh hưởng:** Một caller mới hoặc regression có thể tạo thêm legacy global row dù plan quy định archive read-only; cũng có thể tạo application row thiếu một phần lineage.

**Hướng sửa gốc:** Tách read-only legacy API khỏi application writer; make lineage required ở type/runtime và thêm DB CHECK all-or-none. Xóa/khóa legacy regeneration branch nếu không còn caller hợp lệ.

### P2-04 — GET Personal Report trả raw internal job/error cho client

**Bằng chứng**

- `src/app/api/applications/[id]/personal-report/route.ts:61-70` trả thẳng `generation.job`.
- Job có `locked_by`, attempts, timestamps và `error_message` tại `src/features/apply/api/personal-report-generation-job-queue.ts:12-29`.
- `src/app/api/cron/process-personal-report-generation/route.ts:54` có thể lưu raw `Error.message`; UI hiển thị raw message tại `personal-report-v2-view.tsx:170-171`.

**Ảnh hưởng:** Rò operational/internal provider or database details và buộc client phụ thuộc schema persistence nội bộ.

**Hướng sửa gốc:** Map job sang public DTO tối thiểu (`status`, safe error code/message, reportVersionId); log raw error chỉ ở server.

### P2-05 — Follow-up read coi migration thiếu là state rỗng rồi vẫn phát câu hỏi

**Bằng chứng**

- `src/app/api/applications/[id]/activities/[activityId]/follow-up/route.ts:103-120`: migration-missing read error không trả 503; `rows` trở thành rỗng.
- `route.ts:138-160`: action `question` vẫn phát round-1 question; chỉ action `answer` mới phát hiện insert migration missing và trả 503 tại dòng 195-200.

**Tình huống lỗi:** Môi trường chưa migrate vẫn cho UI bắt đầu follow-up, sau khi user nhập xong mới báo persistence unavailable.

**Ảnh hưởng:** UX sai và có nguy cơ user mất nội dung đã nhập.

**Hướng sửa gốc:** Nếu migration thiếu, cả question và answer phải fail closed 503 trước khi phát câu hỏi. Thêm route test migration-missing read.

## Kiểm tra đã chạy

- `npx gitnexus analyze`: **PASS**, index `main` được refresh (91.7s).
- `npm.cmd run typecheck`: **PASS**.
- 11 test files tập trung cho generation, queue, cron, route, Evidence Bank, Target Profile, reflection, Planner/onboarding và UI: **100/100 tests PASS**.
- 8 test files cho confirm/reopen, Matching/Strategy lineage, history, adaptive follow-up và academic modules: **61/61 tests PASS**.
- Tổng tập trung: **19 test files, 161/161 tests PASS**.

Các test xanh không phủ định findings: phần lớn lỗi nằm ở scenario chưa có fixture (A/B isolation ở Planner/onboarding, exact document linkage, forged/concurrent follow-up, confirm transaction, force-after-claim, existing-report polling và same-key-after-complete).

Không chạy full lint/build/E2E hoặc cross-user RLS trong review này. Log hiện tại cũng ghi RLS cross-user chưa được xác minh trên non-production.

## Thứ tự sửa đề xuất

1. P1-01 → P1-06: khóa toàn bộ application scope và snapshot integrity trước.
2. P1-07 → P1-11: sửa tính đúng đắn của evidence/analysis/follow-up.
3. P1-12 → P1-14: sửa durable queue, idempotency và UI lifecycle cùng một lượt.
4. P2-01 → P2-05: ổn định cache/invariants và harden public API/partial deployments.
5. Chạy lại `npm.cmd run verify:pr`, các race/integration tests mới, và RLS cross-user trên non-production trước khi đổi trạng thái Tasks 1–13 thành complete.

## Implementation update (2026-08-27)

Findings P1-01 through P1-14 and P2-01 through P2-05 were implemented in the
working tree. The implementation adds application-scoped reads and lineage
invariants, atomic confirmation, exact evidence linkage, reflection and
academic persistence, issued follow-up question storage, durable queue
idempotency/race handling, public job DTO mapping, and generation-version-aware
polling. New database scripts:

- `supabase-application-confirm-atomic.sql`
- `supabase-application-follow-up-questions.sql`
- `supabase-application-personal-report-generation-jobs-repair.sql`

Measured checks: full Vitest 362 files / 3440 passed (2 todo), typecheck,
strict typecheck, i18n checker, production build, and `git diff --check` pass;
lint exits with 0 errors and 591 warnings. Live Supabase migration/RLS and
signed-in browser verification are still pending. `npm.cmd run verify:pr` could
not start because this shell has Node 24.13.0 while the repository requires
Node 24.19.0.
