# Kế hoạch 7 ngày tới launch — GlowBal

> Tài liệu làm việc, không phải tài liệu kỹ thuật. Cập nhật cuối mỗi ngày ở phần **Nhật ký**.
> Ngày viết: **T6 24/07/2026** · Launch: **T6 31/07/2026** · Team làm cả T7/CN.

> ⚠️ **Bảng §0 dưới đây là số đo ngày 24/07 (D1), chưa được cập nhật lại kể từ
> đó.** Đây là tài liệu kế hoạch của team, nên các quyết định chiến lược ở §1–§2
> giữ nguyên như bản gốc — không tự sửa. Riêng các con số đo được đã lệch khá xa
> thực tế, ghi lại ở đây để không ai dựa vào số cũ:
>
> - `npm test`: **355 pass / 2 todo** (không phải 342), 23 file.
> - Nguồn kỹ thuật cập nhật nhất cho tiến độ redesign từng trang là
>   [docs/redesign-status.md](docs/redesign-status.md) — bảng "Trang (`page.tsx`)"
>   và "Trang còn dùng class legacy" bên dưới nên đọc từ đó, không phải từ bảng
>   tĩnh này.
> - `/apply`, `/mentors`, và phần dialog chi tiết học bổng của `/my-universities`
>   đã dựng xong kể từ D1 — xem Nhật ký §10, mục **27/07**.
> - **Đã chạy migration `user_universities`** ngày 27/07 — bảng đã sống, không
>   còn là blocker. Xem [docs/known-issues.md](docs/known-issues.md) §1.

---

## 0. Trạng thái nền (đo được, ngày 24/07)

| Chỉ số | Giá trị |
|---|---|
| `npm run typecheck` | ✅ pass |
| `npm test` | ✅ **342 pass / 2 todo**, 22 file — ⚠️ xem cảnh báo phía trên, số này đã cũ |
| Route (page + api) | 112 |
| Tính năng AI lõi | 4/4 **đã chạy end-to-end**, không phải stub |
| Home redesign | **5/10 section**, đang ở `/dev/home`, `/` vẫn là bản cũ — vẫn đúng tính đến 27/07 |
| Dictionary dịch tay | ~620 chuỗi — giữ nguyên, phần còn lại để AI dịch |
| Trang (`page.tsx`) | **56** — xem §2.2. ⚠️ Repo hiện có 59 `page.tsx`; xem redesign-status.md cho số chính xác |
| Trang còn dùng class legacy | **50/56** lúc viết — đã giảm, xem redesign-status.md |
| Bảng log AI call | ❌ **chưa có** — xem §4, §5 |
| Stripe webhook cho Plus | ❌ chưa có → **đã tắt bán Plus** (`PLUS_SALES_ENABLED=false`) |

**Kết luận:** nền tảng khoẻ. Rủi ro của tuần này không nằm ở "code có chạy không" mà ở **scope** và **chi phí AI không kiểm soát**.

---

## 1. Nguyên tắc chốt

1. **Code UI/UX toàn site theo bản redesign trong Figma** (chốt 24/07 — design đã có sẵn nên không phải thiết kế, chỉ dựng).
   *Phép tính phải nhìn thẳng:* **56 trang**, 2 dev, 7 ngày = **4 trang/dev/ngày**. Trong khi 5 section Home vừa rồi mất 2 ngày của 1 dev.
   *Cách duy nhất đạt được:* xem §2.1 — **dựng primitive trước, không dựng từng trang**. 5 section Home chậm vì phải phát minh primitive; các trang sau chỉ là lắp ráp. Nếu D1–D2 không xong bộ primitive thì phép tính trên không thành.
2. **Không tính năng mới.** Từ hôm nay chỉ: hoàn thiện, sửa, khoá chi phí.
3. **Finetune KHÔNG nằm trên đường găng launch.** Xem §5.
4. **D7 (30/07) freeze.** Chỉ P0. Không merge feature.

---

## 2. Scope — làm gì / KHÔNG làm gì

### ✅ Làm
- **UI/UX toàn site theo Figma** — 56 trang, chia tier ở §2.2
- Rate limit + quota + cost cap cho **toàn bộ** route AI
- Golden set + eval harness cho 4 tính năng AI
- Bảng log AI call (phục vụ cả cost control lẫn training data)
- Feedback: bảng thật + triage + fix P0/P1

### ❌ Cắt (không thương lượng)
- **8 trang `admin/`** — chỉ nội bộ team nhìn thấy. Giữ UI cũ, redesign sau launch
- Trang `/about`, `/ai-strategy` (đang có link chết trong nav — gỡ link, không dựng trang)
- **Xoá** 5.365 dòng `globals.css` legacy → sau launch. Xem §2.3: tuần này chỉ cần *không chạm vào*, không cần xoá
- Bán GlowBal Plus (đã tắt) + Stripe webhook → **sau launch**
- Feedback P2
- **Finetune model riêng** → track dài hạn, xem §5

---

## 2.1 Chiến lược: primitive trước, trang sau

Đây là điều kiện sống còn của việc code 56 trang trong 7 ngày.

5 section Home mất 2 ngày **không phải vì layout khó**, mà vì phải dựng `Button`, `Container`, `Section`, `TopNav`, `MobileNav`, `Metric`, `FeatureCard`, `CheckItem` từ con số 0. Hiện `src/shared/ui` mới có **10 file**. Các trang còn lại cần thêm: `Input`, `Select`, `Textarea`, `FormField`, `Card`, `Table`, `Tabs`, `Modal`, `Badge`, `Avatar`, `Pagination`, `Toast`, `EmptyState`, `Skeleton`.

> **D1–D2 cả hai dev dựng primitive, không đụng trang nào.**
> Từ D3 trở đi mỗi trang là lắp ráp, và 4 trang/ngày mới thành hiện thực.

Đổi lại: **hết D2 mà `/` vẫn chưa swap** thì dừng mở rộng, quay về scope guest-facing cũ. Đó là điểm không quay đầu được.

Kiểm tra ở `/dev/kitchen-sink` — trang đó đã có sẵn để đối chiếu primitive với token.

---

## 2.2 Thứ tự trang (làm từ trên xuống, hết giờ thì dừng)

| Tier | Trang | Số | Vì sao thứ tự này |
|---|---|---|---|
| **1** | Home, universities (2), scholarships, auth | 5 | Khách chưa đăng ký chỉ thấy nhóm này |
| **2** | onboarding (3), profile (9) | 12 | Toàn form — **1 bộ `FormField` phủ cả 12 trang** |
| **3** | apply (2), my-universities (3), dashboard (6) | 11 | Người đã trả tiền/đăng ký dùng hằng ngày |
| **4** | mentors (4), achievers (3), guides (2), news, how-it-works, plus (2), feedback, coordinator | 15 | Ít lưu lượng hơn |
| **5** | terms, privacy, newsletter | 3 | Chỉ cần pass token, không đổi layout |
| **❌** | admin (8), dev (2) | 10 | **Cắt** — nội bộ |

Tier 2 là chỗ đòn bẩy lớn nhất: 12 trang nhưng gần như cùng một khuôn form.

---

## 2.3 ⚠️ Ràng buộc kỹ thuật của việc redesign toàn site

**50/56 trang đang dùng class legacy** (`.glowbal-*`, `.auth-*`, `.profile-*`, `.onboarding-*`, `.cosmic-*`, `.geo-*`, `.explorer-*`). Những class này nằm trong 5.365 dòng CSS **unlayered** của `globals.css` và **out-rank mọi utility của Tailwind**.

Nặng nhất: `auth-form.tsx` (54 chỗ), `universities/loading.tsx` (33), `onboarding/profile-form.tsx` (19), `auth/page.tsx` (18).

**Quy tắc bắt buộc — chuyển trang nào thì chuyển dứt điểm trang đó:**

> Một trang chỉ được coi là xong khi **không còn class legacy nào** trong toàn bộ cây của nó.
> Chuyển nửa vời — component mới nằm trong `div` còn class cũ — là trường hợp tệ nhất: CSS cũ ăn xuống component mới và sinh ra lỗi giao diện rất khó truy.

Điều tốt: **không cần refactor `globals.css` tuần này.** Component mới không dùng tên class cũ ⇒ CSS cũ không match ⇒ tự nhiên vô hiệu. Khi cả 56 trang chuyển xong, đống CSS đó thành code chết, xoá sau launch trong an toàn.

Với chrome cấp trang (`body.glowbal-site-shell`, `main.glowbal-main-content`), dùng lại cơ chế `gb-page-full-bleed` mà `/dev/home` đang dùng — đã có sẵn, không phải nghĩ mới.

---

## 2.4 Ba chỗ Figma **chưa** có design — cần xác nhận trước D3

Repo tự ghi lại những chỗ này, không phải tôi suy đoán:

| Chỗ | Bằng chứng |
|---|---|
| ~~Nav cho user **đã đăng nhập**~~ | ✅ **Đã giải quyết.** `TopNav` (`src/shared/ui/top-nav.tsx`) nhận prop `user: { name, avatarUrl, href }` và đã dùng thật trên `/apply`, `/mentors`, `/my-universities`. Không còn là điểm chặn cho Tier 2/3/4 — vẫn cần đọc đúng frame `Đã đăng nhập` (`203:12356`) cho từng trang cụ thể, nhưng primitive đã có sẵn, không phải phát minh lại. |
| `HomeFeatures` block 2 & 3 | Còn là bản mẫu Untitled UI (`104:7188`, `104:7199`) — vẫn đúng tính đến 27/07, xem `MissingContent` trong `src/features/marketing/ui/` |
| Frame Home `104:7113` | Vẫn còn brand tím mặc định `#6941c6` của Untitled UI, chưa bind palette rose |

~~**Nav của user đã đăng nhập là chặn lớn nhất**~~ — đã hết chặn, xem dòng trên.

---

## 3. Lịch tổng

| | D1 T6 24/7 | D2 T7 25/7 | D3 CN 26/7 | D4 T2 27/7 | D5 T3 28/7 | D6 T4 29/7 | D7 T5 30/7 |
|---|---|---|---|---|---|---|---|
| **Dev 1** | 4 section Home | **Swap → `/`** | Tier 1 | Tier 1 | Tier 3 | Tier 3 | Freeze |
| **Dev 2** | Primitive: form | Primitive: layout | Tier 2 | Tier 2 | Tier 2 | Tier 4 | Freeze |
| **AI 1** | Bảng feedback | Rate limit route AI | Cost cap + `ai_usage` | Timeout/fallback | Load test queue | Dashboard lỗi | Trực |
| **AI 2** | Eval harness + golden set #1 | Golden set #2, #3 | Pipeline training data | Tune prompt | Confidence UI | Ghi nhận `user_edit` | Báo cáo |

> Dev 1 dựng nốt Home rồi swap (việc dở dang, không chia được). Dev 2 song song dựng primitive — hai người gặp nhau ở D3, từ đó chia trang theo tier.

---

## 4. Chi tiết theo lane

### Lane A — Dev 1 · Home + Tier 1 + Tier 3

| Ngày | Việc | KPI (đo được) |
|---|---|---|
| **D1** | 4 section Home còn lại: testimonials `104:7225`, FAQ `104:7347`, contact `104:7361`, footer `104:7404` | 4/4 section render ở `/dev/home`; `typecheck` + `test` xanh; baseline e2e `home-preview.spec.ts` cập nhật |
| **D2** | **Swap `/dev/home` → `/`**. Xoá `home-landing.tsx` (~900 dòng) | `/` là design mới; `grep MissingContent src/features/marketing` = **0 call site**; e2e xanh trên cả 3 breakpoint; không horizontal scroll ở 360px |
| **D3** | Tier 1: universities list + detail — 3 ô chọn tier + badge trên card | 3 filter tier chạy; badge đúng token (Reach `#E11D48` / Recommend `#EFF6FF` / Safe `#F0FDF4`); **0 hex thô**; **0 class legacy** trong cây trang |
| **D4** | Tier 1: scholarships + auth | 2 trang xong; state loading/empty/error đủ; mobile 360px sạch |
| **D5–D6** | Tier 3: apply (2), my-universities (3), dashboard (6) | ≥8/11 trang xong; mỗi trang **0 class legacy** |
| **D7** | Freeze | Chỉ commit P0 |

> ⚠️ **Chặn D1:** block 2 & 3 của `HomeFeatures` chưa có copy (Figma còn là bản mẫu Untitled UI). Chủ dự án đang viết. Nếu 12h D1 chưa có → dựng layout, để `MissingContent`, quay lại D2.

> ✅ **Số liệu đã chốt 24/07: 200 trường · 3.000 học bổng.** Đã sửa xong ở cả 3 chỗ: `home-hero.tsx`, `home-metrics.tsx`, và key tương ứng trong `i18n-dictionary.ts`. Block Features vốn đã đúng.
> *Ghi chú để đối chiếu sau:* `data/scholarships.json` đang có **2.903** bản ghi, nên "3000+" là làm tròn lên. Nếu muốn an toàn tuyệt đối thì đổi thành "gần 3.000" — đây là quyết định marketing, không phải kỹ thuật.

---

### Lane B — Dev 2 · Primitive + Tier 2 + Tier 4

> Lane này quyết định cả kế hoạch. Nếu bộ primitive không xong trong D1–D2, Dev 1 sẽ phải tự dựng lại từng cái khi làm Tier 1, và 56 trang sụp về ~15.

| Ngày | Việc | KPI |
|---|---|---|
| **D1** | Primitive form: `Input`, `Select`, `Textarea`, `FormField`, `Checkbox`, `Radio` — dựng theo Untitled UI kit, dùng token, thêm vào `/dev/kitchen-sink` | 6/6 primitive có ở kitchen-sink; **0 hex thô**; `typecheck:strict` xanh |
| **D2** | Primitive layout/hiển thị: `Card`, `Table`, `Tabs`, `Modal`, `Badge`, `Avatar`, `Pagination`, `EmptyState`, `Skeleton` | 9/9 có ở kitchen-sink; snapshot token cập nhật |
| **D3–D5** | **Tier 2: onboarding (3) + profile (9)** — 12 trang gần như cùng một khuôn form. Đây là chỗ `FormField` trả lãi | ≥10/12 trang xong; mỗi trang **0 class legacy** (`profile-*`, `onboarding-*`, `cosmic-*`) |
| **D6** | Tier 4: mentors, achievers, guides, news, how-it-works, plus, feedback, coordinator | ≥8/15 trang xong |
| **D7** | Freeze + smoke thủ công toàn luồng | signup → onboarding → import course → xem match → SOP feedback → tìm học bổng: **chạy trọn, không lỗi** |

**Xen giữa (không xếp ngày, làm khi có):** gỡ link chết `/about` + `/ai-strategy` khỏi `nav-items.ts`; 2 TODO trong `application-workspace-v2.tsx`. Cả hai đều dưới 1 giờ.

---

### Lane C — AI 1 · Chi phí & độ tin cậy *(launch-critical)*

> **Chốt 24/07:** `/api/translate` **giữ nguyên như cũ, không khoá, không sửa gì**. Nó là *tiện ích dịch cho người dùng Việt*, **không phải một trong 4 tính năng AI của sản phẩm** — nên không tính vào lane này và không nằm trong bất kỳ KPI nào dưới đây. Đã dùng ổn định lâu nay.

**4 tính năng AI của sản phẩm** (phạm vi thật của lane này): Course Importer · Profile Match & Tier · SOP Feedback · Scholarship Finder.

| Ngày | Việc | KPI |
|---|---|---|
| **D1** | Bảng `feedback` trong Supabase + trang list nội bộ *(chuyển từ Lane B sang, vì Lane B giờ dồn cho redesign)* | Feedback ghi vào DB; lọc được theo trạng thái |
| **D2** | Rate limit + quota cho các route AI sản phẩm: `analyze-statement`, `analyze-statement-aacc`, `scholarships/search`, `applications/extract`. Dùng `src/lib/rate-limiter` (đã có, mới chỉ dùng ở `course-search-sessions`) + `entitlement-service` | 4/4 route có rate limit; test cho từng route |
| **D3** | **Bảng log AI call** (`ai_usage`): route, user, model, token in/out, chi phí ước tính, latency, thành/bại. Hiện **chưa có bảng nào** → không ai biết đang tiêu bao nhiêu. Kèm cost cap/user/ngày + cap toàn hệ thống | 100% call AI được log; cap hoạt động (vượt → 429 + thông báo rõ); xem được chi phí hôm nay bằng 1 query |
| **D4** | Timeout + degradation cho mọi call AI | Mọi call có timeout; **không màn nào spinner vĩnh viễn**; lỗi có UI riêng |
| **D5** | Load test queue: cron `* * * * *`, `maxDuration 60`, batch 5 → thả 100 job đồng thời | Đo được thời gian drain; nếu >15 phút thì tăng batch và đo lại |
| **D6** | Dashboard lỗi AI (dựa trên `ai_usage`) | Thấy được tỉ lệ lỗi + chi phí theo route trong 24h |
| **D7** | Trực + hỗ trợ freeze | — |

---

### Lane D — AI 2 · Chất lượng output + nền cho finetune

| Ngày | Việc | KPI |
|---|---|---|
| **D1** | **Eval harness** + golden set #1: **20 link khoá học thật, đa dạng** (UK/US/AU, HTML/PDF, trường lớn/nhỏ) cho Course Importer. Chấm theo **từng field** | Harness chạy bằng 1 lệnh; **có số baseline** cho độ chính xác từng field |
| **D2** | Golden set #2 (20 SOP) + #3 (20 profile → match/tier) | 3 baseline số hoá xong. **Không tune prompt trước khi có số** |
| **D3** | Pipeline training data: log `input → output → sửa tay của user` vào bảng riêng (dùng chung `ai_usage` của AI 1) | Dữ liệu bắt đầu tích; có script export ra JSONL |
| **D4** | Tune prompt đúng chỗ tệ nhất mà golden set chỉ ra | **+15 điểm phần trăm tuyệt đối** so với baseline ở feature yếu nhất, đo lại bằng cùng harness |
| **D5** | **Confidence + state lỗi trên UI** cho 4 tính năng AI (quy tắc dự án: dữ kiện AI bóc tách phải hiển thị được độ tin cậy) | 4/4 tính năng có loading / error / low-confidence; rà sạch dữ liệu demo trông giống dữ liệu sinh viên thật |
| **D6** | Ghi nhận `user_edit` — bắt lại **mọi lần user sửa output của AI**. Đây là nhãn vàng cho finetune sau này và là thứ **không thể tạo lại** nếu tuần này không log | Sửa ở 4/4 tính năng đều được ghi; export JSONL chạy được |
| **D7** | Freeze + báo cáo | Chốt số baseline cuối cùng cho 3 golden set |

> **Không finetune trong tuần này** — xem §5. Lane D tuần này = đo lường + ống dẫn dữ liệu, để các tuần sau finetune có cái mà học.

---

## 5. Finetune — track dài hạn, KHÔNG nằm trong tuần launch

**Chốt ngày 24/07:** launch bằng **model OpenAI**. Model riêng sẽ được finetune dần từ dữ liệu thu thập trong quá trình dùng thật, và **kéo dài qua nhiều tuần/tháng** — không ép vào tuần này. Lý do của chính team: model riêng chưa thể thông minh bằng model nền.

Đây là lựa chọn đúng, và nó khiến việc trong tuần launch trở nên rất rõ ràng:

> **Tuần này không finetune gì cả. Tuần này chỉ dựng ống dẫn dữ liệu.**
> Nếu D1–D7 không log lại dữ liệu dùng thật, thì mọi tuần sau đó đều finetune trên số 0.

### Việc duy nhất của tuần launch: bảng `ai_usage`

Hiện **chưa có bảng log AI call nào** (`ai_usage`, `token_usage`, `usage_log` — grep toàn repo, không có). Bảng này phục vụ **ba** mục đích cùng lúc, nên nó đáng làm sớm (D3, do AI 1 dựng — xem Lane C):

| Mục đích | Ai dùng |
|---|---|
| Kiểm soát chi phí + cost cap | AI 1, ngay tuần này |
| Dashboard lỗi/latency | AI 1, D6 |
| **Training data cho finetune** | AI 2, các tuần sau |

**Cần log gì để sau này finetune được** (thiếu cột nào là mất data vĩnh viễn, không truy hồi được):

- `route`, `model`, `prompt_version` — để so sánh giữa các phiên bản prompt
- `input` (đã lọc PII), `output` — cặp dữ liệu gốc
- `user_edit` — **quan trọng nhất**: user sửa lại output thành gì. Đây là nhãn vàng, và là thứ duy nhất không thể tạo lại sau
- `accepted` / `rejected` — user có dùng kết quả không
- `tokens_in`, `tokens_out`, `latency_ms`, `error`

### Lộ trình sau launch

| Giai đoạn | Khi nào | Điều kiện vào |
|---|---|---|
| **P1 — Thu thập** | Từ D3, chạy liên tục | Bảng `ai_usage` sống, có cột `user_edit` |
| **P2 — Đủ data** | Khi ≥ 500 cặp có `user_edit` | Không tính theo thời gian, tính theo lượng data |
| **P3 — Finetune #1** | Sau P2 | Golden set đã tách riêng, không trùng training data |
| **P4 — Ship** | Chỉ khi thắng base trên golden set | A/B, rollback được |

**Mục tiêu finetune đầu tiên nên là Course Extractor**, không phải SOP. Lý do: output có schema rõ ⇒ **chấm tự động theo từng field được** ⇒ biết chắc model mới hơn hay kém. SOP feedback chủ quan, không có đáp án đúng, nên không dùng để đo tiến bộ được — finetune nó trước là tự bịt mắt.

**Golden set (Lane D, D1–D2) vẫn phải làm trong tuần này**, dù không finetune: nó là thước đo để tune prompt ngay bây giờ, và sau này là bài thi cho model finetuned. Làm một lần, dùng cho cả hai.

---

## 6. Cổng launch — không qua thì không mở

| Mốc | Điều kiện |
|---|---|
| **D2 tối** | `/` là design mới · **15 primitive xong ở kitchen-sink** · `npm test` giữ ≥342 pass |
| **D4 tối** | `typecheck` + `test` xanh · 4/4 route AI có rate limit · Tier 1 xong · 0 P0 mở |
| **D6** | Cả team UAT 3 giờ trên **production build**, mỗi người 1 luồng khác nhau |
| **D7** | Freeze. Chỉ P0. Không merge feature |
| **Trước khi mở** | Cost cap bật · dashboard lỗi sống · smoke luồng chính chạy trọn |

---

## 7. Rủi ro

| Rủi ro | Xác suất | Ảnh hưởng | Xử lý |
|---|---|---|---|
| **Không kịp 56 trang** | **Cao** | Site nửa cũ nửa mới | Làm đúng thứ tự tier §2.2. Hết giờ thì dừng ở tier đang làm — **trang chưa đụng vẫn nguyên vẹn**, không hỏng |
| **Chuyển trang nửa vời** | **Cao** | CSS cũ ăn xuống component mới, lỗi rất khó truy | Quy tắc §2.3: xong = **0 class legacy** trong cây trang. Không có trạng thái "đang chuyển" |
| **Nav user đã đăng nhập chưa có design** | Cao | Chặn 26 trang Tier 2–3 | Hỏi designer **D1**. Không có thì Dev 2 phải tự đề xuất từ nav guest |
| Primitive không xong D2 | Trung bình | Cả kế hoạch sụp | Đây là lý do Dev 2 không đụng trang nào trong D1–D2 |
| Copy Home block 2&3 về muộn | Cao | Chặn Dev 1 D1 | Dựng layout trước, để `MissingContent`, ghép sau |
| Chi phí OpenAI vọt | Trung bình | Tiền thật | Cost cap D3 — lý do nó nằm ở D3 chứ không phải D6 |
| Tuần này quên log `user_edit` | Trung bình | **Cao, không sửa được sau** — data đã mất là mất | Ưu tiên `ai_usage` ở D3, không lùi |
| P0 phát sinh muộn từ UAT D6 | Trung bình | Trượt launch | D7 để trống chủ ý, chỉ freeze + fix |

---

## 8. Việc KHÔNG phải của dev — cần người viết nội dung

| Việc | Ai | Hạn | Trạng thái |
|---|---|---|---|
| Copy Home block 2 & 3 (EN) | Chủ dự án | **D1** | Đang viết |
| Chốt số liệu trường/học bổng | Chủ dự án | — | ✅ Xong 24/07: 200 / 3.000 |
| Xác nhận 3 chỗ Figma còn thiếu (§2.4) | Chủ dự án ↔ designer | **D1** | ⚠️ Nav user đã đăng nhập là chặn lớn nhất |
| ~~Dịch tay~~ | — | — | ❌ **Bỏ** — dùng AI dịch như cũ (xem §9) |

---

## 9. Ghi chú i18n (chốt ngày 24/07)

**Quyết định cuối: KHÔNG đụng gì vào phần dịch. Giữ nguyên như đang chạy.**

- Dịch máy tự động qua `/api/translate` — **giữ nguyên**, không khoá, không rate limit, không sửa
- Default **tiếng Anh**, user tự bấm switch — giữ nguyên
- **Không** làm quy trình dịch tay 140 chuỗi. AI dịch đang dùng ổn, không cần thay
- `/api/translate` **không phải tính năng AI của sản phẩm**, chỉ là tiện ích cho người dùng Việt → không tính vào Lane C

Mọi thay đổi i18n thử nghiệm trong ngày 24/07 **đã được revert sạch**. `git status` chỉ còn các file thuộc việc khác.

**Ngoại lệ duy nhất còn giữ:** key trong `i18n-dictionary.ts` được cập nhật theo số liệu mới (200 / 3.000). Bắt buộc phải sửa — key phải khớp từng ký tự với chuỗi tiếng Anh trong JSX, nếu để số cũ thì câu hero mất bản dịch tay và rơi xuống dịch máy.

> Nếu sau này muốn quay lại chuyện dịch tay: chỗ cần biết là `t()` dùng `entry ?? en`, mà `??` **không bắt chuỗi rỗng** — nên key có value rỗng sẽ render ra chữ trắng, không phải fallback tiếng Anh. Phải xử lý chỗ đó trước khi thêm placeholder nào.

---

## 10. Nhật ký

### D1 — T6 24/07
- [x] Tắt bán Plus: `PLUS_SALES_ENABLED=false` — chặn cả server (`/api/plus/checkout` → 403 trước khi chạm Stripe) lẫn UI (card thành preview tĩnh)
- [x] Sửa `onboarding/complete` → `/universities`. Trước đó **mọi user mới đều bị đẩy vào `/plus`** — nếu chỉ ẩn nút thì 100% user mới kết thúc onboarding ở trang bán hàng không bán được gì
- [x] Chốt số liệu 200 trường / 3.000 học bổng — sửa `home-hero.tsx`, `home-metrics.tsx` + key dictionary tương ứng
- [x] Chốt: **không đụng gì vào phần dịch** — mọi thay đổi i18n đã revert sạch (§9)
- [x] Chốt: **redesign toàn site** thay vì đóng băng ở guest-facing (§1, §2.1–2.4)
- [x] `typecheck` ✅ · `test` ✅ 342 pass
- [ ] **Hỏi designer 3 chỗ Figma còn thiếu (§2.4) — nav user đã đăng nhập là gấp nhất**
- [ ] Dev 1: 4 section Home còn lại
- [ ] Dev 2: 6 primitive form

### D2 — T7 25/07
- [ ] …

### D4 — T2 27/07 (mục do trợ lý code ghi lại — không thay cho nhật ký của Dev 1/Dev 2)

Không có thông tin về D2, D3 nên không tự điền — hai mục trên vẫn để trống chờ team tự ghi. Phần dưới đây chỉ là những gì đã build và verify được trong phiên làm việc hôm nay, xếp theo tier của §2.2:

- [x] **Tier 3 — `/apply`** dựng lại từ Figma `337:18767` ("My application"), thay thế `apply-dashboard.tsx` cũ (1.455 dòng). Giữ lại Course Importer (dán URL) và modal course-search vì frame không vẽ nhưng đây là tính năng lõi, không phải rác. Verify bằng dữ liệu thật (progress_percentage 92/60/30 lên đúng 3 màu token), 0 lỗi console, không tràn ngang ở 360/768/1440.
- [x] **Tier 3 — `/my-universities`**: thêm panel chi tiết học bổng (Figma `337:19349`). Mọi field đều là cột thật trong bảng `scholarships` — không phải mã voucher như tên frame gợi ý.
- [x] **Tier 4 — `/mentors`** dựng lại từ Figma `154:8345`. Nhân tiện phát hiện và sửa 1 bug production có sẵn từ trước: `achiever_profiles` không có RLS cho phép đọc công khai, nên trang mentor **trống trơn với mọi khách chưa đăng nhập** — không liên quan gì đến redesign, chỉ tình cờ lộ ra khi build lại trang này.
- [x] **Migration `user_universities` đã chạy** (chủ dự án tự chạy) — xem known-issues.md §1. Đây là blocker đã ghi trong docs từ 26/07.
- [x] **Nav user đã đăng nhập** (đánh dấu "chặn lớn nhất" ở §2.4) hoá ra **đã có sẵn** trong `TopNav`, không cần dựng mới.
- [x] `typecheck` + `typecheck:strict` ✅ · `lint` ✅ 0 lỗi (30 warning, không tăng) · `test` ✅ 355 pass / 2 todo · `test:e2e` ✅ 49 pass / 0 fail (3 skip vì thiếu `E2E_EMAIL` khi chạy Playwright trực tiếp)
- [ ] Còn lại theo kế hoạch §2.2: `/plus` (Tier 4), `/universities/[slug]` (route mới trong Tier 1 — thay `/universities/vinuni` hardcode)
- ⚠️ **Lệch khỏi quyết định "Cắt" ở §2:** bản gốc chốt "gỡ link chết `/about`, `/ai-strategy`, không dựng trang". Thực tế `/about` **đã được dựng** (từ 26/07, frame `153:11401`) và chủ dự án vừa yêu cầu dựng tiếp `/ai-strategy` (chưa bắt đầu, 21 frame, xem redesign-status.md) thay vì gỡ link. Ghi lại ở đây vì nó đổi phạm vi launch so với §2 — chủ dự án nên biết để cân nhắc lại KPI D7.
