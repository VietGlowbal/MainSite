# Personal Report và Matching Report Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `executing-plans` and `test-driven-development` to implement this plan task-by-task.

**Goal:** Hoàn thiện ba bước đầu của AI Journey: Reflection → Personal Report → GlowBal Matching Report.

**Architecture:** Tái sử dụng hồ sơ, Reflection và Match Insights hiện có. Personal Report có contract và bảng latest-only riêng; Matching Report tiếp tục gắn với từng `course_application` và mở rộng `application_match_analyses` bằng input hash để cache đúng phiên bản dữ liệu.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres RLS, OpenAI structured output, Zod, Vitest và Playwright.

---

## Tóm tắt

- Hoàn thiện ba bước đầu của AI Journey: Reflection → Personal Report → GlowBal Matching Report.
- Tái sử dụng toàn bộ dữ liệu onboarding, Reflection, achievement/activity, điểm thi và Match Insights hiện có.
- Personal Report lưu một phiên bản mới nhất; Matching Report gắn với từng `course_application` và dùng `application_match_analyses`.
- Nội dung và UI hoàn toàn bằng tiếng Việt; user chủ động bấm tạo/cập nhật.
- Cho phép tạo khi hồ sơ thiếu dữ liệu, nhưng mọi kết luận thiếu bằng chứng phải mang trạng thái `limited`, confidence thấp và limitation rõ ràng.

## Thay đổi triển khai

### 1. Migration và contract dùng chung

- Tạo `supabase-ai-strategy-reports.sql` với bảng `student_personal_reports`:
  - `user_id` làm primary key và foreign key tới `auth.users`.
  - `report jsonb`, `input_hash`, `prompt_version`, `model_name`.
  - `generated_at`, `updated_at`.
  - RLS owner-only cho SELECT/INSERT/UPDATE.
- Bổ sung `input_hash` vào `application_match_analyses` và index theo application, prompt version, hash, thời gian tạo.
- Tạo contract Zod cho Personal Report:
  - `summary`, `confidence`, `limitations`.
  - Sáu section cố định: `coreIdentity`, `drivingForce`, `signaturePattern`, `emergingThemes`, `personalPositioning`, `proofOfMe`.
  - Narrative section dùng `{status, headline, narrative, evidenceRefs}`.
  - Tối đa 5 emerging themes và 8 proof items.
- AI chỉ trả ID evidence. API xác minh ID thuộc context rồi hydrate thành `{id, kind, label}` trước khi lưu.

### 2. Candidate context dùng chung

- Tạo server-only loader lấy dữ liệu trực tiếp theo authenticated user:
  - Hồ sơ học tập, mục tiêu, ngành, quốc gia, ngân sách, funding, goals và career interests.
  - `student_achievements`, `student_activities`.
  - English và standardized test scores.
  - Trạng thái tài liệu; Matching tiếp tục dùng CV/SOP text đã parse theo cơ chế hiện có.
- Thay việc Matching chỉ đọc `student_profiles.achievements` bằng context có cấu trúc.
- Giới hạn tối đa 20 achievement, 20 activity và độ dài từng text trước khi đưa vào prompt.
- Dùng `crypto.createHash('sha256')` trên context đã canonicalize để tạo stable input hash.
- Stored text luôn được đánh dấu là dữ liệu không tin cậy; model không được làm theo instruction nằm trong profile, CV hoặc course content.

### 3. Personal Report API và trang UI

- Thêm `POST /api/ai-strategy/personal-report`; request không nhận profile facts từ client.
- Dùng `OPENAI_API_KEY`, `OPENAI_MODEL` và strict JSON schema; prompt version `personal-report-v1-vi`.
- Confidence được tính từ mức đầy đủ của dữ liệu, không tin trực tiếp score do model tự khai.
- Cache/quota:
  - Cùng input hash và prompt version: trả bản cache.
  - Free user: tối đa một AI call mới mỗi 24 giờ.
  - Plus user: được tạo lại theo hành vi hiện có.
  - Input thay đổi: report cũ vẫn hiển thị với badge “Dữ liệu mới hơn báo cáo”.
- Thêm `/ai-strategy/report`:
  - Empty state với nút “Tạo báo cáo”.
  - Hiển thị summary, confidence, limitations và sáu tab/section theo mockup.
  - Khi cập nhật, giữ report cũ trên màn hình; lỗi không làm mất dữ liệu.
  - Khi profile trống, vẫn tạo report nhưng các section phải là `limited`, không sinh trait chung chung.
- Sau khi lưu Reflection bước 2, điều hướng sang `/ai-strategy/report`.

### 4. Nâng cấp Match Insights và Matching Report

- Giữ backward compatibility cho `POST /api/applications/[id]/match-insights`.
- Bump prompt version thành `match-insights-v2-vi`, dùng context có cấu trúc và strict schema tiếng Việt.
- Cache chỉ hợp lệ khi đúng `applicationId`, input hash và prompt version.
- Rate limit 24 giờ chỉ tính các analysis thuộc prompt version hiện tại; dữ liệu v1 cũ không chặn lần tạo v2 đầu tiên.
- Thêm `/ai-strategy/matching`:
  - Liệt kê course applications thuộc user.
  - Empty state dẫn tới `/apply`.
- Thêm `/ai-strategy/matching/[applicationId]`:
  - Kiểm tra application thuộc user; không thuộc user cũng trả 404.
  - Hero lấy university image/logo, tên trường, programme, quốc gia và rankings.
  - Tổng điểm/confidence lấy từ latest v2 Match Insights.
  - Sáu section được dựng như sau:
    - Why this university: university insight/best-for + analysis strengths.
    - Programme overview: course summary, degree, duration, study mode và intake.
    - Personal alignment: personal pillar score, summary và evidence.
    - Admission requirements: course entry/English requirements và university GPA/test requirements.
    - Costs and scholarships: course tuition, living cost và published scholarships.
    - Profile gaps: dedupe weaknesses và gaps từ các pillar.
  - Evidence freshness hiển thị official URL, source confidence và `last_extracted_at`.
  - Fact thiếu phải ghi “Chưa có dữ liệu đã xác minh”; AI không được tự điền.
  - CTA “AI Strategy” dẫn về `/ai-strategy` và hiển thị trạng thái “Sắp ra mắt”.

### 5. Journey navigation và responsive UI

- Cập nhật `AI_JOURNEY` thành nguồn duy nhất cho href và active state:
  - Reflection → `/ai-strategy/reflection`.
  - Personal Report → `/ai-strategy/report`.
  - GlowBal Matching Report → `/ai-strategy/matching`.
  - Hai bước sau giữ locked/coming soon.
- Report pages dùng inverse/dark surface theo mockup và design tokens hiện có.
- Desktop có section navigation sticky; mobile xếp một cột, tabs cuộn ngang có accessible label.
- Bổ sung loading, empty, cached, stale, cooldown, limited-data, 404 và retry states.
- Thêm các route report vào danh sách PII routes để nội dung cá nhân không đi qua machine-translation API.

## Public API và lỗi

- `POST /api/ai-strategy/personal-report`
  - `200`: `{ report, cached, nextRegenerationAt }`.
  - `401`: chưa đăng nhập.
  - `429`: đang trong cooldown, trả `nextRegenerationAt`.
  - `502`: AI timeout hoặc output sai schema; không overwrite report cũ.
  - `503`: thiếu AI configuration hoặc migration.
- `POST /api/applications/[id]/match-insights`
  - Giữ response success hiện tại.
  - Có thể bổ sung `nextRegenerationAt` khi trả `429`.
  - Không xóa hoặc đổi tên field mà `MatchInsightsPanel` đang dùng.
- GitNexus đánh giá route Match Insights ở mức MEDIUM vì có một consumer; mọi thay đổi response phải được kiểm tra với component hiện tại.

## Kiểm thử và tiêu chí nghiệm thu

- Unit test:
  - Zod contract, evidence-ref ownership, output limits.
  - Stable input hash và thay đổi hash khi profile/course/document đổi.
  - Confidence, stale detection, cache, cooldown và dedupe gaps.
  - Mapping deterministic cho toàn bộ sáu matching sections.
- API test:
  - `401`, owner-scoped `404`, cached response, free cooldown, Plus regeneration.
  - Hồ sơ trống vẫn trả Personal Report limited.
  - Evidence ref giả, JSON sai hoặc AI failure trả `502` và giữ bản cũ.
  - Missing migration/config trả `503`.
- Component test:
  - Empty, loading, cached, stale, limited, cooldown và error-with-old-report.
  - Tabs, keyboard navigation và accessible progress/score labels.
- E2E:
  - Reflection → tạo Personal Report → chọn application → tạo Matching Report.
  - Course application của user khác không truy cập được.
  - Kiểm tra 360/768/1440px và không có horizontal overflow.
- Chạy focused Vitest, full unit suite, lint, typecheck và production build.

## Quyết định và mặc định đã khóa

- Matching Report gắn với một course application cụ thể.
- Toàn bộ UI và AI output bằng tiếng Việt.
- User chủ động bấm tạo/cập nhật; không có queue hoặc background generation.
- Personal Report chỉ lưu bản mới nhất; Matching giữ history hiện có nhưng UI chỉ đọc bản v2 mới nhất.
- Hai report miễn phí, giữ cooldown 24 giờ hiện tại cho free user.
- Không triển khai report history, streaming, Personalized Strategy, Application Planner hoặc crawler mới trong v1.
- Release theo thứ tự: chạy migration → deploy code → smoke test free/Plus → theo dõi call count, cache hit, latency và tỷ lệ 429/502 mà không log PII.
