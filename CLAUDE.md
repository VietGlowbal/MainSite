# CLAUDE.md

Hướng dẫn này giúp Claude Code hiểu đúng bối cảnh dự án GlowBal khi code theo design từ Figma.

> **Đọc `docs/README.md` trước khi bắt đầu.** Đó là bản bàn giao trạng thái
> codebase: trang nào đã dựng lại theo Figma, node-id của từng frame,
> primitive nào đã có sẵn, bug/blocker đang mở, và cách verify. Mục đích là để
> không phải dò lại những gì phiên trước đã xác định. Code luôn thắng nếu docs
> lệch.
>
> chủ dự án yêu cầu bộ ghi chú bàn giao này. Đừng xoá.

## Môi trường & lệnh hay dùng

Máy dev là **Windows**; shell mặc định là PowerShell, Bash (Git Bash) cũng có.

- **Thư mục làm việc đã đúng sẵn** — đừng prefix `cd`/`Set-Location`. Lịch sử
  phiên cho thấy hơn 1.100 lệnh đã lãng phí token vì việc này.
- **`jq` KHÔNG được cài.** Đừng viết pipeline dựa vào `jq` — dùng `node -e`.
- Node được ghim ở `24.19.x` (`.nvmrc`, `engines`).

| Việc | Lệnh |
|---|---|
| Typecheck | `npm run typecheck` · strict: `npm run typecheck:strict` |
| Lint | `npm run lint` |
| Unit test | `npm test` · một file: `npx vitest run <file>` |
| Build (bắt buộc sau mỗi merge) | `npm run build` |
| Cổng đầy đủ trước PR | `npm run verify:pr` |
| E2E | `npm run test:e2e` |

Chi tiết + baseline đo được: `docs/verification.md`.

**Slash command có sẵn** (`.claude/commands/`):
`/verify` chọn đúng cổng kiểm tra cho thay đổi hiện tại · `/db-schema` liệt kê
schema Supabase thật (**không bao giờ đoán tên bảng** — xem `docs/README.md`).

Một PreToolUse hook (`.claude/hooks/migration-guard.mjs`) sẽ nhắc khi bạn sửa
một file `supabase-*.sql` đã commit: migration đã chạy không sửa lại được, phải
viết file follow-up mới (`docs/known-issues.md §0`).

## Bối cảnh sản phẩm

GlowBal là nền tảng AI đồng hành cho sinh viên Việt Nam apply du học & săn học bổng. Các tính năng lõi:
- **Smart Course Importer** — dán link khoá học, AI bóc tách thành blueprint apply nhiều giai đoạn
- **Profile Match & Tier List** — xếp trường theo reach/match/safe kèm điểm match và gợi ý cải thiện
- **SOP/Personal Statement Feedback** — chấm điểm bài viết, gợi ý sửa trích dẫn nguyên văn, checklist tiêu chí
- **Scholarship Finder** — gợi ý học bổng khả thi kèm mức độ cạnh tranh

Đây đều là các màn hình hiển thị **dữ liệu do AI sinh ra** (điểm số, tier, mức độ tin cậy, gợi ý) — khi code UI cho các phần này, ưu tiên đúng cấu trúc dữ liệu và trạng thái hiển thị (loading / error / confidence level) đã có trong design, nếu muốn sáng tạo hay có điểm gì bất hợp lí thì cần hỏi ý kiến của tôi để ra quyết định.

## Tech stack (bám sát, không tự đổi thư viện)

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Form & validate:** react-hook-form + Zod
- **Animation:** GSAP, Framer Motion
- **3D:** `react-globe.gl` (bọc Three.js). ⚠️ Globe **đã bị bỏ khỏi
  `/universities`** khi trang này dựng lại theo Figma — thiết kế mới là lưới
  phẳng có filter (chủ dự án chốt). Chỗ duy nhất còn render globe là trang legacy
  `/my-universities/[id]`; hero trang chủ dùng ảnh PNG tĩnh, không phải 3D. Đừng
  thêm globe vào trang mới vì thấy dependency này còn trong `package.json`.
- **Data/Auth:** Supabase (Postgres, Auth, Storage, Row-Level Security)
- **Thanh toán:** Stripe
- **Ngôn ngữ:** song ngữ Anh–Việt (i18n EN–VI), mặc định ưu tiên hiển thị đúng cả 2 ngôn ngữ khi tạo component có text


## Design system

Design mới **dựng trên Untitled UI / Figma Simple Design System**, không phải hệ thống riêng của GlowBal. Các component trong Figma là instance của kit đó: `Buttons/Button`, `Badge`, `Pagination`, `_Dropdown header navigation button`, `_Nav actions`, `_Footer logo`, `_Footer links column`, `Social icon`, `Ratings badge`.

→ Khi code component mới, **map về primitive trong `src/shared/ui`**, không dựng lại từ đầu và không tự phát minh variant ngoài những gì kit có.

### Design tokens

Nguồn thật là `src/styles/tokens.css` (trích từ Figma variables). **Không hard-code màu/spacing/radius trong component** — dùng token.

Đã chốt từ Figma:
- **Neutral ramp:** `#171717` `#262626` `#404040` `#525252` `#737373` `#a3a3a3` `#d4d4d4` `#e5e5e5` `#fafafa` `#ffffff`
- **Spacing:** `xxs 2 · xs 4 · sm 6 · md 8 · lg 12 · xl 16 · 2xl 20 · 3xl 24 · 4xl 32 · 5xl 40 · 6xl 48 · 7xl 64 · 9xl 96` — **không** phải thang 4px mặc định của Tailwind
- **Radius:** `none 0 · sm 6 · md 8 · lg 10 · xl 12 · full 9999` — nhỏ hơn nhiều so với code cũ (`rounded-[1.5rem]`/`[2rem]`), đừng giữ giá trị cũ
- **Type scale:** `text-xs 12/18 · text-sm 14/20 · text-md 16/24 · text-lg 18/28 · text-xl 20/30 · display-xs 24/32 · display-sm 30/38 · display-md 36/44 · display-xl 60/72`
- **Font:** body **Inter**, display **Bricolage Grotesque** (letter-spacing `-2` ở display sizes). Luôn kèm `subsets: ['latin', 'vietnamese']`
- **Container:** max-width desktop 1280, padding 32
- **Shadow:** `shadow-xs` = `0 1px 2px #0000000d`

- **Brand:** **rose `#E11D48`** (Figma `Colors/Rose/600`) — màu CTA/nút primary. Các bậc còn lại của ramp lấy theo thang rose của Tailwind, chỉ 600 là design-confirmed.
- **Tier admission (đã chốt):** encode phân loại reach/recommend/safe mà `src/lib/admission-fit.ts` đang tính. Thiết kế mới nâng nó thành trục điều hướng chính của trang trường (3 ô chọn ở đầu trang + badge trên từng card).
  - Reach — nền `#E11D48`, chữ trắng
  - Recommend — nền `#EFF6FF`, chữ `#2563EB`
  - Safe — nền `#F0FDF4`, chữ `#15803D`


### CSS quarantine

`src/app/globals.css` là CSS **unlayered** — nó out-rank Tailwind utilities.

**Đã dọn ngày 2026-09-05 (xem `docs/performance.md` fix 5):** 5.042 → **1.192
dòng**, 404 → **83 class selector**. 490 rule chết đã bị xoá sau khi đối chiếu
hai chiều: grep toàn bộ source, *và* thu thập class thật từ DOM trên 65 lượt tải
trang (47 route, cả đã đăng nhập lẫn ẩn danh) — 1.281 class xuất hiện thật, không
class nào nằm trong danh sách xoá.

Component mới:
- **Không** dùng tên class legacy: `.glowbal-*`, `.auth-*`, `.glow-*`,
  `.profile-*`, `.cosmic-*`, `.cosmos-*`, `.onboarding-*`, `.geo-*`
  (`.explorer-*` nay đã sạch hoàn toàn)
- **Không** render bên trong 3 root còn lại (CSS trong đó sẽ ăn vào con):
  `.geo-article`, `.cosmos-light-zone`, `.onboarding-form-shell`.
  Năm root cũ — `.auth-secure-notice`, `.profile-upload-tip`,
  `.profile-empty-state`, `.cosmic-step-card`, `.glowbal-nav-pill-admin` — đã bị
  xoá khỏi `globals.css`, không còn ràng buộc.

Không dùng tên nào trong danh sách trên là đã miễn nhiễm với cascade cũ.

⚠️ Trước khi xoá thêm CSS: `.glowbal-main-content` và quy tắc
`body:has(… [data-testid='nav-header']) [data-global-navigation] { display:none }`
**không được xoá** — đó là thứ duy nhất ngăn hai header cùng hiện trên các trang
tự dựng chrome. Cách đúng là thêm route vào `OWN_CHROME_ROUTES`
(`src/components/nav-reveal.tsx`), không phải dựa vào quy tắc CSS đó.

## Kiến trúc

Code mới theo Feature-Sliced Design. ESLint ép các ranh giới này (`no-restricted-imports`):

```
src/app/          # route mỏng, chỉ orchestrate
src/features/<domain>/{api,domain,ui,hooks}/
src/shared/{ui,tokens,lib,types}/
src/server/{db,auth,cache,observability}/
```

1. `app/` không import thẳng `@/server/db` — phải qua repository ở `features/*/api`
2. `features/*/ui` không import `features/*/api`
3. Không import chéo feature — code dùng chung nâng lên `shared/` hoặc `server/`
4. `shared/*` không phụ thuộc `features/`, `app/`, `server/`
5. `createAdminClient` bypass RLS — chỉ dùng trong `src/server`, API route, hoặc repository
6. Cấm hex thô trong `src/features/**` và `src/shared/ui/**`

File mới dưới `features/`, `shared/`, `server/` chạy dưới `tsconfig.strict.json` (thêm `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`).

## Quy tắc khi code theo Figma

1. **Luôn đọc đúng frame đang select hoặc đúng node-id trong link** — không code từ trí nhớ hay đoán mò phần chưa thấy rõ.
2. **Giữ nguyên cấu trúc component** trong Figma — không tự gộp/tách khác đi so với design, trừ khi tái sử dụng component có sẵn trong codebase.
3. **Spacing, typography, màu sắc** lấy đúng từ design tokens/variables trong Figma, không làm tròn hay áng chừng.
4. **Với các màn có nhiều state** (loading, error, confidence thấp/trung/cao, tier reach/match/safe) — kiểm tra Figma có variant riêng cho từng state không, code đủ tất cả các state đó thay vì chỉ code state mặc định.
5. **Responsive:** kiểm tra Figma có frame/variant riêng cho mobile không trước khi tự suy ra breakpoint.
6. Với màn phức tạp, chia nhỏ theo section/frame, code và review từng phần trước khi ghép lại toàn trang.

## Lưu ý về nội dung AI-generated trong UI

- Structured output (điểm số, JSON schema) cần hiển thị được thành UI kiểm tra được — không phải khối text tự do.
- Mọi dữ kiện AI bóc tách cần có chỗ hiển thị **mức độ tin cậy** (confidence level) nếu design có thiết kế phần đó.
- Không hard-code dữ liệu mẫu trông giống dữ liệu thật của sinh viên — dùng placeholder rõ ràng là dữ liệu demo.
- **Dữ liệu crawler (`catalog_programmes`, `courses`, `academic_units`, `crawl_*`) là AI bóc tách, không phải dữ liệu đã biên tập.** Trước khi đưa lên UI:
  - `verification_status = NEEDS_REVIEW` là **trạng thái mặc định**, không phải cảnh báo sai (390/404 dòng). Đừng lọc theo nó — lọc sẽ chỉ còn 1/24 trường có dữ liệu. `REJECTED` mới là cờ "pipeline đã loại"; chỉ loại theo cờ đó.
  - Tên bị nối hết mọi facet (dài tới 154 ký tự, lặp cả tên khoa). Phải cắt bớt — nhưng **chỉ cắt phần đuôi**, cắt giữa chuỗi sẽ xoá mất phần phân biệt ("Computer Science – Online Degree (MS)" → "Computer Science").
  - Cùng một ngành thường có nhiều bậc học; mọi thao tác khử trùng lặp phải xét cả **tên và bậc học**.
  - Thay vì gắn nhãn "chưa xác minh" lên gần như mọi dòng, hãy nói một lần nguồn dữ liệu đến từ đâu và cho link `official_url` để sinh viên tự kiểm chứng.

  Chi tiết + số đo trong `docs/known-issues.md §1a`.

@AGENTS.md
