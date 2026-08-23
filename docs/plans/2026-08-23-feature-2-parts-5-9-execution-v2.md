# Feature 2 Parts 5–9 — Execution Plan (v2, sau merge PR #216)

> Trạng thái: **ACTIVE execution plan** (không phải point-in-time intent).
> Bản trước của phạm vi này nằm ở `docs/feature-2-parts-5-9-reviewed-plan.md`
> (reviewed spec — vẫn là nguồn cho acceptance criteria chi tiết từng task).
> Bản v2 này điều chỉnh trình tự theo hiện trạng code sau merge `f342231`.

> **For Claude:** REQUIRED SUB-SKILL: dùng superpowers:executing-plans để thực
> thi từng task; mỗi behavior-changing task chạy theo vòng TDD (characterize →
> failing test → minimal impl → focused test → commit).

**Goal:** Hoàn tất workflow sau-báo-cáo (Planner mobile + reminders, productize
GenUI task UI, gộp CV/Essay, đóng nốt Final Check) mà không phá dữ liệu người
dùng, không trùng bề mặt sản phẩm, không tự bịa spec cho phần BLOCKED.

**Architecture:** Bám Feature-Sliced Design; reminder tái dùng pipeline
Resend/`email_deliveries`/cron đã live; GenUI giữ hợp đồng persisted
backward-compatible; CV/Essay là consolidation; Final Check đã có sườn từ
PR #216 — chỉ audit + đóng gap.

**Tech stack:** Next.js 16 App Router · React 19 · TS strict · Tailwind 4
(token `gb-*`) · Supabase/Postgres/RLS · Vitest (chạy được trong session) ·
Zod · Resend.

---

## 0. Ma trận READY / GATE / BLOCKED (Wave-0 gate của reviewed-plan, đã đo)

| Area | Trạng thái | Điều kiện mở |
|---|---|---|
| Planner mobile (Part 5.1–5.4) | **READY** | sau 5.1 characterization |
| Planner reminders (Part 5.5–5.8) | **READY** | policy đã chốt trong `docs/email-system.md` |
| Planner task UI (Part 6) | **READY** | sau 5.1; F8/seed/GenUI contract đã ổn định |
| CV + Essay (Part 7) | **GATE** | chốt ownership (câu hỏi owner #1) |
| Final Check (Part 9B) | **READY (một phần)** | audit gap chạy được ngay; gap đụng CV/Essay chờ Wave 3; đối chiếu spec (câu hỏi owner #2) trước 9B-B |
| Strategy Master Hub (Part 8) | **BLOCKED** | chờ design mới (câu hỏi owner #3) |
| Scholarships (Part 9A) | **BLOCKED** | chờ spec sản phẩm (câu hỏi owner #3) |

**Câu hỏi mở cho chủ dự án (không chặn Wave 1–2):**

1. CV/Essay: ai đang sở hữu? (chốt trước Wave 3)
2. Đối chiếu scope Final Check đã ship của #216 với
   `docs/strategy-reports-spec.md`: chấp nhận phần nào, gap phần nào?
   (chốt trước 9B-B)
3. Spec Scholarships + design Hub mới: khi nào có?

## 0b. Thay đổi so với reviewed-plan (hiện trạng sau merge `f342231`)

| Hạng mục | Reviewed-plan giả định | Hiện tại |
|---|---|---|
| Matching Report route canonical | Seam mở | **Xong** — #216 wire `getMatchingReportPageData` + six-section view |
| F5 engine | Cần implement | **Canonical** — `assessProgrammeFit`, AcademicBand, `strong_match`, điểm thập phân, `unknown ≠ not_met`, contract test |
| Strategy Report | Six-tab | **Five-section**; priority từ `portfolioEvaluations`; Add-to-Planner giữ |
| **Final Check (9B)** | Xây mới, gate spec | **Sườn có sẵn**: route + API + repository + `supabase-final-check.sql`, `computeReadiness()` deterministic, nav đã unlock → Wave 4 = audit + đóng gap |
| Planner deadline input | — | 3 commit jayyyyte: chặn năm dở, rollback — phải khóa bằng characterization test |
| AI narrative Matching Report | — | **Đã loại bỏ** theo thiết kế #216 — không khôi phục |
| GenUI block types | 7 loại | **4 loại thật** (`structured_table`, `long_text`, `checklist`, `single_select`); user-state tách `content_value`; malformed → null |
| Planner UI | 1 board | **3 UI cùng route** theo `getPlannerMode()` (legacy/trung gian/canonical) |
| i18n copy mới | Dictionary chính | Thêm quy ước **per-surface catalog** (`i18n-matching-report/-strategy-report/-final-check.ts`) |
| Vitest | Chạy ngoài sandbox | **Chạy được trong session** |
| Ops treo | — | `supabase-final-check.sql` chưa chạy production; engine-version stamp `application_match_analyses` chưa có (P1) |

Baseline sau merge (đo 2026-08-23): typecheck ✅ · strict ✅ · lint 0 errors ·
`check-i18n --all` xanh · dictionary 4.523 key / 0 dup · `npm test` 2.944 pass
(2 fail timeout-flaky, pass khi chạy cô lập — nhiễu baseline, không phải merge
damage).

---

## 1. Trình tự sóng + cổng

```
Wave P0  Lưu kế hoạch + chốt câu hỏi sở hữu      [READY]
Wave 1   Part 5 — Planner mobile + reminders     [READY]
Wave 2   Part 6 — Productize GenUI task UI       [READY sau 5.1]
Wave 3   Part 7 — CV + Essay consolidation       [GATE: ownership]
Wave 4   Part 9B — Final Check gap-audit + close [READY phần không phụ thuộc CV/Essay]
BLOCKED  Part 8 (Hub); Part 9A (Scholarships)
```

Wave 4 lên sớm hơn reviewed-plan: chạy song song/đan xen Wave 2–3 cho các gap
không đụng CV/Essay.

---

## 2. Wave P0 — Dọn đường

- **P0.1** Lưu kế hoạch này + route từ `docs/README.md`. ✅ (file này)
- **P0.2** Ma trận READY/GATE/BLOCKED + câu hỏi owner. ✅ (mục 0)
- **P0.3** Ops (owner chạy): áp `supabase-final-check.sql` trên dev +
  production (không sửa file SQL), xác minh route Final Check hết 503.
- **P0.4** P1, không chặn: migration stamp engine-version cho
  `application_match_analyses` (file SQL mới) — cần cho freshness 9B-C.

---

## 3. Wave 1 — Part 5: Planner mobile + reminder delivery

### 5.1 Characterization tests (trước mọi thay đổi layout)

Mở rộng: `planner-board.test.tsx`, `planner-calendar.test.tsx`,
`planner-list.test.tsx`, `hierarchical-application-planner.test.tsx`,
`use-application-planner.test.tsx`, `use-planner-recommendations.test.tsx`.

Phủ: đổi status (kéo + control không-kéo), sửa deadline **kể cả hành vi mới
của jayyyyte** (năm dở không lưu, valid range, rollback), complete/reopen,
thứ tự task, calendar UTC/Monday-first 6 tuần, roadmap task render, block
malformed/unknown degrade cục bộ. Cả 3 UI trên cùng route
(`getPlannerMode()`: legacy `StrategyCategoryBoard` / `ApplicationPlanner` /
canonical `HierarchicalApplicationPlanner`) đều phải được khóa hành vi.

**Gate:** mobile/reminder work không được định nghĩa lại task semantics.

### 5.2 Mô hình tương tác mobile (quyết định thiết kế)

- Kanban: mobile = **1 cột/list active** qua segmented control có count từng
  status; không xếp 5 cột dọc; đổi status luôn có đường không-kéo.
- Calendar: mobile = **date strip ngang + agenda ngày chọn**; giữ month-nav +
  tone overdue/today/upcoming (`DueTone`).
- Hierarchical: phase/step accordion thu gọn, micro-step full-width, count ở
  header phase.

Không hover-only; token `gb-*`; empty state gọn.

### 5.3 Responsive board rework

Files: `planner-board.tsx` (`md:grid-cols-3 xl:grid-cols-5` tại dòng 50),
`planner-calendar.tsx`, `planner-list.tsx`, `planner-shared.tsx`,
`hierarchical-application-planner.tsx`. Tách selector/domain chung khỏi
presentation; cả 2 presentation gọi cùng `useApplicationPlanner`/
`usePlannerRecommendations` (giữ optimistic + per-field rollback — kể cả
rollback deadline mới). Không fetch đôi.

### 5.4 Calendar mobile

`planner-calendar.tsx` + `calendar-agenda.tsx` mới. Test: chọn ngày → đúng
task; 0/1/nhiều task; tray không-deadline; boundary tháng; narrow viewport.

### 5.5–5.6 Khóa policy + pure eligibility

Module mới `src/lib/email/planner-reminders.ts` (pure, server-only):

```ts
export type ReminderDecision =
  | { kind: 'none'; reason: string }
  | { kind: 'deadline'; slot: '30d' | '7d' | '1d'; applicationId: string }
  | { kind: 'same_day_batch'; applicationId: string }
  | { kind: 'weekly_digest'; userId: string };
// event_key: deadline-{slot}:{applicationId}:{deadlineIso} ·
//            same-day:{applicationId}:{dateIso} ·
//            strategy-digest:{userId}:{isoWeek}
```

Input: `course_applications.deadline` + authority (`official`/`user_set`/
`derived` cho phép; **`unknown` loại**), prefs `deadline_reminders`/
`weekly_strategy_digest`, `timezone`, run-time, event_key đã gửi (query
`email_deliveries`). 13 test case theo reviewed-plan (30/7/1, completed-
excluded, no-deadline, pref off ×2, batching, midnight theo tz, đổi hạn →
key mới, cron rerun → 0 duplicate).

### 5.7 Wire vào pipeline có sẵn

Mở rộng `/api/cron/lifecycle-emails/route.ts`: 2 processor
`plannerDeadlineReminders` + `weeklyStrategyDigest`; batch ≤200; try/catch
per-item; log có cấu trúc. Gửi qua `sendEmail()` (`category:'product_reminder'`,
`template:'deadline-reminder'`, `idempotencyKey` = event_key — claim duplicate
có sẵn qua `beginEmailDelivery`). Không tạo mail sender/cron/preference store
mới.

### 5.8 Email rendering

Dùng lại `deadlineReminderEmail` (CTA về planner giữ `applicationId`); template
mới `weeklyStrategyDigestEmail` trong `src/lib/emails/lifecycle.ts`; zero-task
→ **không gửi**; ngôn ngữ theo `preferred_language` theo cách template hiện có
làm.

### 5.9 Regression pass

Focused vitest + typecheck + lint + `check-i18n --all` + build; manual matrix
mobile + fixture 30/7/1-day + pref off.

---

## 4. Wave 2 — Part 6: Productize GenUI task UI

- **6.1 Fixture matrix** (gate): 4 loại thật × hợp lệ/thiếu-optional/malformed
  + unknown type/version. Không dựng 7 loại của plan gốc (YAGNI).
- **6.2 Version hóa nhỏ nhất**: optional `v` trên từng variant của
  `contentBlockSchema`; thiếu `v` = legacy v1; lạ → parse null → fallback
  renderer; không bulk-rewrite row cũ.
- **6.3 Ownership**: schema = generated (`content_schema`, chỉ reconcile ghi);
  progress = user-owned (`content_value`/`status`/`deadline`); checklist
  identity theo domain_node_id qua regenerate — test chứng minh.
- **6.4 Registry hoá `content-block.tsx`**: `ui/content-blocks/` với
  `registry.ts` (exhaustive + `FallbackBlock`), 4 input riêng; dispatcher mỏng
  giữ props cũ.
- **6.5–6.8 Productize từng block**: mobile card-per-row cho table; aria cho
  long_text; checklist giữ progress qua regenerate; single_select giữ
  `semanticKey`; keyboard + focus + không color-only + narrow viewport.
- **6.9** Không migration (reader backward-compat đủ); nếu buộc phải → SQL
  mới, idempotent, dry-run.
- **6.10 Verify với F8 thật**: generate → Add-to-Planner → sync ×2 không nhân
  bản; 1 block hỏng không đổ trang; mobile nghĩa trọn vẹn.

---

## 5. Wave 3 — Part 7: CV + Essay consolidation [GATE ownership]

Decision record (hướng đã ghi `docs/ai-strategy-route-audit.md` — UX Apply trên
model AI-Strategy), capability matrix + characterization cả 2 hệ, service
boundary qua `strategy-repository.ts`, vertical slices
read→save→generate→export→staleness, redirect giữ context, một Essay workspace
writing+feedback cùng draft/version, Planner deep-link chỉ trỏ route canonical.
**Không bắt đầu khi chưa chốt ownership (câu hỏi owner #1).**

---

## 6. Wave 4 — Part 9B: Final Check gap-audit + close [phần lớn READY]

Sườn đã có từ #216; công việc còn lại là đối chiếu reviewed-plan + spec rồi
đóng gap:

- **9B-A Audit hiện trạng** (bán ngày): map `src/lib/ai/final-check.ts` +
  route + repository vs 9B.1–9B.8 — đặc biệt: (1) check có **stable ID** chưa;
  (2) **freshness/invalidation** khi nguồn đổi; (3) mỗi issue có **deep-link
  "Fix this"** chưa; (4) phạm vi nguồn — có đọc F5 hard-gates, F8 roadmap,
  Planner task completion theo spec không.
- **9B-B Đóng gap deterministic**: bổ sung nguồn qua aggregator
  (`fetchPlanningContextSources`, latest match analysis, micro-steps
  completion) — không tự tính lại điểm F5/F8; stable IDs `cv.stale`,
  `deadline.approaching_30d`…; `unknown ≠ fail`. *(Chờ câu hỏi owner #2.)*
- **9B-C Freshness**: recompute-on-read + hiển thị "đánh giá lúc"; sau P0.4 có
  engine-version stamp để so nguồn.
- **9B-D Deep-link + unlock chuẩn**: mọi issue fix-able nội bộ có nút mở đúng
  workspace (giữ `applicationId` + return); rà tiêu chí unlock nav 9B.8.
- **9B-E Tích hợp CV/Essay**: chỉ sau Wave 3 — link trỏ route canonical.
- **9B-F Regression**: acceptance scenarios 1–7 của reviewed-plan.

---

## 7. BLOCKED — chỉ làm đúng mức cho phép

- **Part 8 Hub**: read-only audit + characterization tests route/lock/readiness
  (8.1–8.3). Không redesign trước design mới.
- **Part 9A Scholarships**: chỉ audit catalogue thành tài liệu. Không
  route/schema/AI trước spec.

## 8. Quy tắc ngang

1. TDD từng task; không trộn migration+route+redesign trong 1 commit.
2. Migration chỉ viết **file SQL mới** (migration-guard); idempotent, rollback,
   RLS review.
3. User-owned state không bị regenerate ghi đè âm thầm.
4. Idempotency cho mọi enqueue/migrate/reconcile.
5. Mọi write path mới test wrong-user/wrong-application.
6. Error model phân biệt input/permission/AI-fail/persistence/malformed-block/
   stale/blocked; 1 block hỏng không đổ trang.
7. **A11y/i18n/mobile**: keyboard + focus + touch-target + copy VI dài; copy
   mới theo per-surface catalog hoặc dictionary chính — gate `check-i18n --all`
   phải 0 missing.
8. File mới dưới `features/shared/server` chịu `tsconfig.strict.json`; tôn
   trọng ESLint boundaries.
9. Route/API mới: đọc `node_modules/next/dist/docs/` trước khi code.

## 9. Verification & DoD (rút gọn)

Sau mỗi wave: focused vitest (in-session) + typecheck + strict + lint +
`check-i18n --all` + build; kết quả đo được ghi `docs/current-status.md`.
Regression searches cuối chương trình theo §Verification của reviewed-plan.

DoD: mobile planner đủ workflow không kéo-thả; reminder retry 0 duplicate +
pref honored; 4 block + unknown/malformed degrade an toàn, progress sống qua
regenerate; (nếu Wave 3 mở) 1 canonical CV + 1 Essay workspace không mất dữ
liệu; Final Check có stable IDs + freshness + deep-link đủ; Hub/Scholarships
không mở khóa oan.
