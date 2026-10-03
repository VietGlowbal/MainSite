# Design brief — GlowBal Home, sales customer journey (for Claude Design)

> **IMPLEMENTED 2026-09-27** on branch `feature/home-sales-journey-redesign`
> from the resulting handoff (`design_handoff_home_redesign/`). What shipped,
> the nav-gating deferral, and which [CONFIRM] items went out at their defaults
> are recorded in [../current-status.md](../current-status.md) — read that, not
> this brief, for the current state.
>
> **Status:** prompt written 2026-09-27 from the owner's PDF "Customer Journey for
> Sales | GlowBal" (21 pages). Paste everything below the line into Claude
> Design, **attach that PDF**, and attach the Canva images it links to. When the
> mockups come back, Claude Code builds from them. Items marked **[CONFIRM]** are
> conflicts inside the PDF or between the PDF and the live checkout. They are
> listed at the end so the owner can settle them first.

---

## 0. Your task

Design **high-fidelity UI mockups** for the redesigned **Home page of GlowBal**
(glowbal-education.com). Its only job is to move a visitor down one sales
funnel:

> land on Home → understand what GlowBal does → see proof (numbers, stories,
> mentors) → see the path and the tools → pick a package or press a CTA →
> **fill in the free consultation form at the bottom of the page.**

**Claude Code will implement your mockups** in an existing Next.js 16 +
Tailwind 4 codebase. It has a fixed design system (§2) and several of these
sections already exist on the live site (§3). So:

- Stay inside the design system. Every colour, size, radius and spacing value
  you use must be one of the tokens in §2.
- Where a section already exists, **keep its visual language and change only
  what this brief changes.** Attached screenshots of the live page show what
  exists today.
- Treat the attached PDF's screenshots as **content and intent, not
  pixel-final**. They are rough and sometimes contradict the PDF's own text.
  Where they disagree, this brief says which one wins.

Deliverables are in §6.

---

## 1. Product and audience

GlowBal is an AI-assisted study-abroad and scholarship platform built by
Vietnamese students for Vietnamese students.

- **Primary audience:** Vietnamese high-school students aged 16–18 who want a
  scholarship abroad. Many prepare their applications alone.
- **Secondary audience:** their parents, who read the pricing and pay.
- **Languages:** the site is bilingual. **English is the default**, and every
  string has a Vietnamese version. Vietnamese is typically **20–35% longer**, so
  layouts must survive it (see the VI check in §6).
- **Tone:** confident, warm, peer-to-peer ("built by people who won these
  scholarships"). Not corporate.

**The one conversion:** the consultation form (`#contact`) at the foot of
Home. For signed-out visitors, **every CTA on the page leads there**, except
Sign in and Sign up. Each CTA scrolls smoothly to the form without leaving the
page.

---

## 2. Design system (hard constraints)

The system is built on **Untitled UI**. Use its component anatomy (Button,
Badge, Input, Select, Checkbox, Avatar, Pagination, dropdown nav) and do not
invent variants the kit does not have.

**Colour**

| Role | Value |
|---|---|
| Brand / primary CTA | **Rose 600 `#E11D48`** (hover Rose 700 `#BE123C`) |
| Brand tints | Rose 50 `#FFF1F2` · Rose 100 `#FFE4E6` · Rose 300 `#FDA4AF` · Rose 500 `#F43F5E` |
| Neutrals | `#000000` · `#0A0A0A` · `#171717` · `#262626` · `#404040` · `#525252` · `#737373` · `#A3A3A3` · `#D4D4D4` · `#E5E5E5` · `#FAFAFA` · `#FFFFFF` |
| Dark bands | background `#000000`, cards `white/5–8%`, borders `#404040` or `white/10%`, text `#FAFAFA` |
| Light bands | background `#FFFFFF` (or `#FAFAFA`), text `#171717`, secondary text `#525252`, borders `#E5E5E5` |

Rose is the **only** accent. Never purple (it is Untitled UI's default and not
GlowBal's), and no other hues except soft, blurred rose glows behind content,
which the live site already uses. Do not use blue, green or amber tier colours
on this page.

**Type**

- Display: **Bricolage Grotesque** for headings, with slight negative
  letter-spacing (−2%). Body: **Inter**. Both must render Vietnamese
  diacritics. Do not add a third font.
- Scale (size/line-height, px): `xs 12/18 · sm 14/20 · md 16/24 · lg 18/28 ·
  xl 20/30 · display-xs 24/32 · display-sm 30/38 · display-md 36/44 ·
  display-lg 48/54 · display-xl 60/72`

**Spacing** (px, use no other values): `2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 ·
40 · 48 · 64 · 96`. Section vertical padding is usually 96 on desktop and 64 on
mobile.

**Radius:** `6 · 8 · 10 · 12 · 16 · full`. Cards use 12–16. **Nothing rounder
than 16** except pills and avatars.

**Shadow:** `xs = 0 1px 2px #0000000D` · `lg = 0 4px 6px -2px #00000008, 0 12px 16px -4px #00000014`.

**Layout:** content max-width **1280**, side padding **32** (desktop) and
**16** (mobile). Design at **1440** and **390**.

**Buttons:** `primary` (rose fill) · `primary-on-dark` · `secondary` (white,
border) · `secondary-on-dark`. Sizes sm–xl. **One primary (rose) action per
section.**

**Icons:** two-tone line icons (dark stroke plus a rose accent stroke), sitting
in a round rose-tinted disc when used as a section mark. On dark bands the
disc is rose at 15% opacity.

---

## 3. Page structure: final section order

The page contains exactly these sections, in this order, plus the existing
footer. The anchors are what Claude Code will use.

| # | Section | Anchor | Band | Today on the live site |
|---|---|---|---|---|
| 0 | Navigation (3 states) | — | dark bar | exists, **changes** |
| 1 | Hero | `#hero` | dark | exists, **changes** |
| 2 | Scholarship Showcase + Library preview | `#scholarships` | dark | exists, light touch |
| 3 | Scholarship Success Stories | `#stories` | dark | **new** |
| 4 | Standout Numbers | `#numbers` | light | exists, **3 metrics instead of 5** |
| 5 | The Team Behind Your Journey | `#team` | light | exists as a grid, **becomes a carousel** |
| 6 | Your GlowBal Journey | `#journey` | dark | **new content** in an existing card style |
| 7 | Product Features | `#features` | light | exists, **adds video** |
| 8 | Pricing | `#pricing` | light, soft rose wash | **new on Home** |
| 9 | Free Consultation Form | `#contact` | light | exists, **new fields and states** |
| — | Footer | — | near-black `#0A0A0A` | unchanged |

**Removed from Home:** the "Have you ever?" pain-point cards, the 5-step "How
it works" carousel, the scholarship-pillars block and the FAQ. Section 6
replaces the first two. Do not draw them.

---

## 4. Section by section

### 0 · Navigation: three states

The bar is black and fixed, and the logo sits on the left. It has three states,
depending on who is looking.

| State | Who | Desktop bar (left to right) |
|---|---|---|
| **A · Guest** | not signed in | Logo · **Home** · EN/VI switch · `Sign in` (secondary-on-dark) · `Sign up` (primary rose) |
| **B · Pending** | signed up, but has not yet submitted the consultation form | Logo · **Home** · EN/VI · avatar and first name (menu: Profile, Sign out) |
| **C · Full access** | signed in with access granted | Logo · Home · GlowBal News · Search ▾ (Scholarships, Universities, Advisors) · Strategy Master · My Portal · EN/VI · avatar · **`Plan your Global Education`** (primary rose) |

- The old "Register" button no longer exists. It becomes **Sign in** plus
  **Sign up**.
- **State B needs one more element (a proposal, please draw it):** a slim
  rose-tinted strip under the nav on Home: *"One step left — tell us about your
  goals to unlock free scholarship & university search."* with the action
  `Complete the form →` (scrolls to `#contact`). Without it, a new user who
  signs up sees a page with only "Home" and no idea why.
- **Mobile:** logo, hamburger, and the rose CTA where it fits. Draw the open
  drawer for A, B and C.
- A floating round rose **"?" help button** sits bottom-right on every screen.
  It already exists. Keep it in the mockups.

### 1 · Hero (dark)

- **H1:** "The ultimate solution for scholarship hunters"
  (VI: "Giải pháp công nghệ toàn diện dành cho 'dân săn học bổng'")
- **Subtitle:** "From discovering suitable universities and scholarships to
  building a personalised strategy and tracking your applications, GlowBal
  supports your entire journey."
- **Primary CTA (rose, xl):** `Register for Free Consultation`, which scrolls to
  `#contact`. This is now the hero's **only** primary action. The old "Plan
  your Global Education" button is **removed from the hero** for guests.
- **Microcopy under the CTA** (italic, 80% white): "Find a Scholarship that Fits
  You 100% free". This is the current live copy; the PDF screenshot's older
  "University" wording is superseded.
- **Visual:** the existing **draggable dotted globe**, on the right (desktop)
  and above the headline (mobile). **Change:** land dots are neutral grey, and
  **only countries where GlowBal has scholarship data light up in rose**. For
  the mockup, use an illustrative set such as the US, UK, Canada, Australia,
  Singapore, Hong Kong, Japan, Korea, the Netherlands and Germany. Claude Code
  will bind the real list. Optionally, hovering a lit country shows a small
  tooltip "United Kingdom · N scholarships", with **N as a visible
  placeholder**, not a made-up number.
- **Caption under the globe:** "With insights from 3,000+ scholarships, we help
  you apply for the best global education route." The globe **no longer has a
  second button** under it.

### 2 · Scholarship Showcase + Library preview (dark)

This section already exists and only needs a refresh. University crests sit on
an elliptical orbit around a centred heading. Each crest has a coloured strip
underneath it: "Up to $450K" / "Up to $600K" (keep the current values).

- **Heading:** "Choose from 200+ of the world's leading universities with $150M+
  in total scholarship value" **[CONFIRM 200+ vs 900+]**
- **Sub-line:** "Study **Anywhere**". "Anywhere" is rose, and it changes to the
  hovered crest's country on hover (existing behaviour).
- **CTA:** `Find scholarships`. It **expands an inline Scholarship Library
  preview** under the orbit and the label toggles to `Hide scholarships`. The
  preview is built in code but **not yet deployed**, so the live screenshots
  still show `Find scholarships` as a plain link. PDF page 5 shows its cards.
- **Library preview (light card area on the dark band):** a search field,
  funding filter chips (Merit-based · Need-based · Research · Full tuition), a
  count line "Showing 6 of 2,877 scholarships", and **6 scholarship cards in a
  3×2 grid** (1 column on mobile). **Card anatomy:** type badge
  ("University-specific" / "Foundation / provider"), heart icon, title (2-line
  clamp), organisation, a rose-50 value box (amount in rose, detail line
  clamped), funding chips, one eligibility line (clamped), a divider, then the
  deadline with a calendar icon on the left and `Register to view details →`
  on the right.
- **Behaviour:** clicking a card **does not open the scholarship**. It scrolls
  to the form. Put a **notice bar** under the grid that explains why:
  *"Want the full library and the scholarships that fit you? Register for a
  free consultation — a GlowBal mentor will send you your shortlist."* with the
  action `Register for free consultation`.
- Draw: preview closed, preview open, and card hover.

### 3 · GlowBal Scholarship Success Stories (dark, new)

- **Title:** "GlowBal Scholarship Success Stories"
- **Layout (desktop):** one large **featured story card** on the left, with a
  horizontally scrolling row of **quote cards** on the right that bleeds off
  the edge (masonry heights, two rows). Drag, arrows or snap scroll. On
  mobile, the featured card is on top and the quotes are a swipe carousel.
- **Featured card: Phạm Quỳnh Chi.** Portrait on the left (use the attached
  photo) with her name over the bottom of the photo. On the right, the
  heading "Achievements":
  - 100% Merit-based Scholarship for Bachelor of Business Administration —
    VinUniversity **[CONFIRM 100% vs 90%]**
  - 100% Scholarship — Fulbright University
  - Vice Chancellor Scholarship — RMIT
  - Education Development Scholarship — BUV
  - Full Scholarship — Lingnan University
  - At the bottom, a row of the university logos (VinUniversity, Fulbright,
    RMIT, BUV, Lingnan). Use neutral labelled placeholders if the logos are
    not attached.
  - **The video will come later.** Design the photo area as **video-ready**: a
    play button and a "Watch Chi's story" label. Also draw the fallback state
    with no video (photo only, no play button).
- **Quote cards.** These are real students, so use the quotes **verbatim**
  (Vietnamese is the original). Use a rose opening-quote mark, the quote
  clamped to about 6 lines with a `Read more` toggle that expands in place,
  then the name in bold and the school in muted text. **There are no photos:
  use initials avatars** (rose-100 disc, rose-700 initials). Do **not**
  generate faces for real, named people.

  1. **Nguyễn Hoàng Minh Anh** — THPT Lê Quý Đôn, TP HCM
     VI: "Với em, GlowBal là nơi tổng hợp thông tin của Facebook và Threads :))) Vì những bạn tự chuẩn bị hồ sơ như em lúc nào cũng lock in vào những bài feed, đọc chia sẻ, cố gắng tìm bài luận mẫu,... để tự định hướng và gom thông tin. GlowBal sẽ giúp ngay từ bước đầu khi chắt lọc sẵn thông tin về trường → học bổng → quy trình apply → và các thông tin liên quan. GlowBal được xây dựng dựa trên kinh nghiệm từ các anh chị nên em cảm giác những khó khăn mà em đang gặp phải thì GlowBal sẽ giải quyết được."
     EN (draft): "For me, GlowBal pulls together everything I used to dig for on Facebook and Threads :))) Students who prepare their applications alone, like me, are always locked into feeds, reading people's stories and hunting for sample essays just to find a direction. GlowBal helps from the very first step by filtering the information for you: universities → scholarships → the application process → everything around it. It's built on the experience of older students, so I feel the problems I'm facing are ones GlowBal can solve."
  2. **Nguyễn Ngọc Khánh Linh** — THPT Chuyên Bến Tre
     VI: "GlowBal có tổng hợp thông tin về các trường đại học trên thế giới nên em cảm thấy mình có thể tiết kiệm thời gian và đỡ lan man hơn. Nhờ có chức năng này mà em cũng cân nhắc được thêm vài quốc gia, trường và ngành học mà trước đây em chưa từng nghĩ đến. Em sẽ mô tả GlowBal là một web hỗ trợ tìm kiếm học bổng mới lạ và hữu ích nhất mà em từng trải nghiệm, đặc biệt còn có các tính năng như lên kế hoạch apply, hỗ trợ xây dựng CV và bài luận như một mentor."
     EN (draft): "GlowBal brings together information on universities around the world, so I save time and stay focused. Thanks to it, I started considering a few countries, universities and majors I had never thought of. I'd call GlowBal the most novel and useful scholarship-search site I've used — especially with application planning and CV and essay support, like having a mentor."
  3. **Trần Hoàng Lê Thành** — THPT Chuyên Ngoại ngữ, Hà Nội
     VI: "Yếu tố ăn khách nhất của GlowBal bây giờ là scholarship matching, và em thấy rằng không nhiều học sinh nghĩ đến học bổng một cách chi tiết và hoàn thiện như vision của GlowBal."
     EN (draft): "GlowBal's biggest draw right now is scholarship matching — and not many students think about scholarships in as much detail, or as completely, as GlowBal's vision does."
  4. **Đinh Thành Minh** — Vinschool Ocean Park 1
     VI: "GlowBal là một web/app giúp tìm trường phù hợp, tạo lộ trình và theo sát tiến trình."
     EN (draft): "GlowBal is a web app that helps you find the right university, build a roadmap and stay on top of your progress."
  5. **Nguyễn Hoàng Bảo Minh** — The Dewey Schools THT
     VI: "Em ấn tượng với bảng profile của GlowBal vì nó được làm rất chỉn chu và đáp ứng tất cả những thứ em cần. Với em, đây là một web định hướng du học rất chất lượng do chính người Việt làm ra."
     EN (draft): "I was impressed by GlowBal's profile dashboard — it's carefully made and covers everything I need. To me it's a genuinely high-quality study-abroad guide, made by Vietnamese people."
  6. **Hà Trung Khải** — Vinschool Smart City, Hà Nội
     VI: "Mặc dù chưa trải nghiệm quá nhiều để hiểu hết về GlowBal, em vẫn thấy ấn tượng về mục tiêu mà team hướng tới vì nó đem lại giá trị thực sự cho người tìm đến GlowBal. Vào đây chọn gói cao nhất, không quá đắt mà team vẫn xịn, chăm sóc hết từ đầu đến cuối =))))"
     EN (draft): "I haven't used GlowBal long enough to know all of it, but I'm impressed by what the team is aiming for — it brings real value to the people who come here. Pick the top plan: it isn't expensive, the team is great, and they look after you from start to finish =))))"
  7. **Nguyễn Uyên Nhi** (no school given)
     VI: "Em siêu thích phần định hướng dựa trên personal accounts, cảm giác em được nhìn nhận đúng hơn về mình và biết cách để mình lựa chọn môi trường phù hợp nhất."
     EN (draft): "I love the guidance built on personal accounts — I feel seen more accurately, and I know how to choose the environment that suits me best."

  Mockup language: EN page = the EN drafts with a small "Translated from
  Vietnamese" label. VI page = the originals.

### 4 · Standout Numbers (light)

This section already exists: rose icon disc, title, an italic quote, and
numbered stat cards. Values count up on scroll, a thin rose rule draws in
under each card, and a soft glow follows the pointer. **Cut it from 5 cards
to 3.**

- **Title:** "Standout numbers"
- **Subtitle (a quotation, with the quote marks):** "GlowBal has shown how much
  it invests in product quality, and how well it answers what the market
  actually needs"
- Cards: a number `01/02/03` top-left, an icon disc top-right, a big rose value,
  and a label.
  1. **7,800+** — "Scholarship searches run" (search icon)
  2. **413** — "Regular users" (users icon). The live site says 370, so this
     is an update.
  3. **$2,000 & ₫1.2B** — "Backed by VinUniversity (Venture X) & AOF (Young
     Startup Competition)" **[CONFIRM the wording "Invested by" vs "Backed by"
     / "Awarded by"]**. **Put the VinUniversity and AOF logos** in this card,
     as small monochrome logos above or beside the label.
- ⚠️ In the PDF screenshot, card 3's value overflows its card. Solve it. For
  example, set the two amounts on two lines ("$2,000" then "+ ₫1.2B" at a
  smaller size), or shrink the display size for this card only. **All three
  cards must be the same height.**

### 5 · The Team Behind Your Journey (light)

- **Title:** "The team behind your journey". The PDF sketch hand-letters it in
  rose. Use the display font in rose, and optionally add a hand-drawn SVG
  underline as the one playful touch. Do not add a script font.
- **Intro (max width ~768):** "GlowBal is driven by a distinguished team across
  technology, education, research, and communication, with first-hand
  experience in scholarships and study-abroad journeys. Combining student
  insight, specialist expertise, and technology, we turn fragmented advice into
  a clear, personalised system — from identifying the right competitions and
  research opportunities to strengthening CVs, SOPs, and overall application
  stories."
- **UI: a cover-flow carousel.** One large centre card, with smaller cards on
  both sides that recede in depth (scaled down, slightly rotated in 3D, faded;
  about 2 visible per side on desktop). Include prev/next arrows, dots,
  keyboard arrows and swipe. The centre card is the only interactive one.
  Clicking a side card brings it to the centre. On mobile, show one card with
  the neighbours peeking in.
- **Centre card anatomy (from the sketch):**
  - **Left column:** a portrait photo, with the university logo in a chip at
    the bottom.
  - **Right column:**
    - **Name** plus a role badge (Mentor / Supporter / Advisor).
    - The intro (1–3 lines), **if there is one**.
    - A 2-column meta block: `STUDIES AT` · `PROGRAMME`, and `EXCHANGE` when
      present.
    - An achievements list: a rose check-circle icon on each line, with a
      small grey **category caption** under it (Education · Scholarship ·
      International · Advising · Research · Competition · Work).
  - Show the **first 4 achievements**, then `+N more` to expand.
  - **When a mentor has a "students guided" figure, show it as a highlighted
    stat chip.** The sketch asks for this. Only Nguyễn Khánh Linh has one
    today: "Guided 12 students to VinUniversity merit scholarships (1 × 100%,
    4 × 80%, 7 × 70–75%)".
  - **The card must look complete without an intro.** Five members have none.
    Never invent one.
- **Photos:** use neutral placeholder frames labelled with each person's name,
  unless photos are attached. Do not generate faces.
- **Roster** (the order is the carousel order; start centred on #2):

| # | Name | Role | Studies at | Programme | Exchange | Intro | Achievements |
|---|---|---|---|---|---|---|---|
| 1 | James David Lapslie | Mentor | University of Birmingham, UK | Master of Computer Science | — | — | Finalist, Undergraduate of the Year 2026 (AI category) · Semi-finalist, Inter-Campus Enterprise Competition 2025 & 2026 · Led a team of eight to win the Birmingham Project Award with Siemens UK · Led a team of six to complete the Engineering Education Scheme with GKN Automotive · Vice-President, University Debate Society · Bronze winner, Birmingham Debate Pro Am 2026 · Accepted onto the Algoverse 2026 AI research program · Accepted into the Engineering and Science Leadership Academy 2026 |
| 2 | Nguyễn Khánh Linh | Mentor | VinUniversity | Bachelor of Business Administration (80% Merit-based Scholarship) | University of Birmingham, UK | — **[CONFIRM: "With passion…" is unfinished]** | Represented VinUniversity on exchange at the University of Birmingham, UK · Advised 1 × 100%, 4 × 80%, 7 × 70–75% Merit-based Scholarship winners at VinUniversity (incl. CBM, CAS and CECS) · 4-time Dean's List Academic Award recipient · Worked at VinDynamics – Vingroup and Laulau Learning Vietnam |
| 3 | Nguyễn Hoàng Linh | Mentor | VinUniversity · Carnegie Mellon University | Bachelor of Business Administration | University of Birmingham, UK | — | 80% merit-based scholarship at Carnegie Mellon University · 75% Merit-based Scholarship, VinUniversity · Represented VinUniversity on exchange at the University of Birmingham, UK · Worked at EY Consulting Vietnam |
| 4 | Phạm Quỳnh Chi | Supporter | VinUniversity | Bachelor of Business Administration | — | (shortened draft, **[CONFIRM]**) "Back at GlowBal in a new role, I bring first-hand experience to help you strengthen your SOP & CV, build a strategic extracurricular profile and map a clear path to your dream universities." | 100% Merit-based Scholarship (BBA) — VinUniversity · 100% Scholarship — Fulbright University · Vice Chancellor Scholarship — RMIT · Education Development Scholarship — BUV · Full Scholarship — Lingnan University · First Runner-Up, Social Pioneers (Social Marketing Competition) · Second Runner-Up, ISME Debate Contest · Encouragement Prize, RMIT Business Plan Competition |
| 5 | Nguyễn Văn Huấn | Technical & Academic Advisor | Hanoi University of Science and Technology | Bachelor of Information Technology | — | "With experience in AI research, innovation, and technology competitions, I help students build a strong academic profile, discover research and STEM opportunities, and navigate program and scholarship applications abroad with greater confidence." | First Author, MVA research paper on nighttime vehicle localisation — under review at Neural Computing and Applications (Q1 Scopus) · Bronze Prize, FTU Student Scientific Research Competition (Vietnamese NLP sentiment analysis) · Team Leader, AuraBeam Research Project (AI-powered anti-glare adaptive headlights) · Top 2 & Top 8, SOICT Technology Showcase (HUST) · Top 25, VinUni Datathon · Active in research, entrepreneurship and innovation initiatives at HUST |
| 6 | Tạ Đức Hiển | Technical & Academic Advisor | Hanoi University of Science and Technology | Bachelor of Information Technology | — | "From data/research competitions and academic projects to scholarship positioning, I provide practical guidance to make your profile stronger, more distinctive, and application-ready." | Second Runner-up, HBAAC · Top 8 HUST Representatives, G-TIP Competition (South Korea & Malaysia) · Second Runner-up, Data Science Talent Competition 2026 · Second Prize, Student Scientific Research Competition 2025 · Cumulative GPA 4.0/4.0 · 3-time recipient, Academic Encouragement Scholarship · Outstanding Student Award 2024–2025 |
| 7 | Phùng Thị Hương | Academic & Extracurricular Advisor | Foreign Trade University | Bachelor of International Political Economics | — | "Drawing from my experience in case competitions, research, and extracurricular activities, I can help students discover the right opportunities, build a standout profile, and navigate their study-abroad journey with confidence." | 1st Runner-up, Social Marketing Competition · Consolation Prize, WAH Business Case Competition · 2 conference papers · 2-time recipient, Academic Encouragement Scholarship |
| 8 | Lý Giai Mẫn | Academic & Extracurricular Advisor | VinUniversity · Fulbright University | Bachelor of Economics | — | — | IELTS Overall 9.0 · VinUniversity Scholarship — 80% tuition |
| 9 | Chu Tuấn Linh | Technical Advisor | Hanoi University of Science and Technology | Bachelor of Information Technology | — | — | HKUST Top 1% Achiever · Outstanding Achievement in AI & Data Science · Second Runner-up, Young Entrepreneurship Competition 2026 |
| 10 | Nguyễn Tuấn Kiên | Academic & Extracurricular Advisor | Academy of Finance | Bachelor of Customs and Logistics | — | — | Second Runner-up, Young Entrepreneurship Competition 2026 · 3-time recipient, Academic Encouragement Scholarship · "5 Good Students" Award 2024–2025 · Top 5 Finalist, Gems of AOF |

Draw the centre card for **#2** (the richest: exchange row plus the "guided"
stat), **#1** (8 achievements, so it shows `+4 more`) and **#9** (no intro,
3 achievements, so it must not look empty).

### 6 · Your GlowBal Journey (dark)

This reuses the live site's dark card style: a rose icon disc top-left, a
large faint step number top-right, the title, then the body.

- **Section mark:** a rose icon disc, then the eyebrow "Have you ever?" in rose.
- **Title (2 lines):** "A study-abroad dream, but no clear path forward." /
  "GlowBal guides your journey"
- **4 step cards:**
  1. **01 · Discover Your Direction** — "Assess your background, interests, and
     goals to match with the most fitting study-abroad options."
  2. **02 · GlowBal Matcher: Unlock Best-Fit Scholarships and Universities** —
     "Access exclusive opportunity networks and identify high-value
     scholarships tailored to your profile and your universities."
  3. **03 · Strategy Master: Craft Your Winning Strategy** — "Build a compelling
     application strategy, highlighting your unique strengths and showcasing
     your potential."
  4. **04 · Receive 1-on-1 Support** — "Work closely with dedicated experts who
     guide and support you through every detail until success."
- **Proposal:** a thin connector line with a travelling rose dot between the 4
  cards, so the row reads as a path rather than a list. On mobile, make it a
  vertical timeline.

### 7 · Product Features: two tools (light)

- **Title:** "Learn how GlowBal helps you find scholarships from A to Z with
  just two simple features"
- **Block A (text left, media right): GlowBal Matcher.** Icon disc · "GlowBal
  Matcher" · lead "Find what fits you, not simply what is famous." · body
  "Answer a few questions about your goals, strengths and direction. GlowBal
  Matcher helps you discover universities and scholarships worth exploring
  further." · three check items: Personalised recommendations · University and
  scholarship discovery · Save promising opportunities · CTA `Discover your
  matches`.
- **Block B (media left, text right): Strategy Master.** Lead "Finding the
  right option is only the beginning." · body "Strategy Master helps you
  understand your profile, evaluate your fit and turn your study-abroad goals
  into an actionable strategy." · four check items: Applicant Personal Report ·
  GlowBal Matching Report · Personalised Strategy · Application Planner · CTA
  `Build my strategy`.
- **Media = a short demo video** (16:10, radius 12, shadow-lg) with a poster,
  a centred rose play button, a "Live preview" chip and the duration.
  **Draw two states:** the video poster, and the fallback shown until the
  video files exist. The fallback is the animated product mock the live site
  uses today: skeleton rows plus rose bar chart, a "92% fit" chip for Matcher
  and "On track" for Strategy Master.
- **Optional supporting-tools strip** under both blocks: one compact row of 3
  small cards (Planner · SOP review · CV review), with an icon and one line
  each. It must not make the section taller than one short row.
- For signed-out visitors, both CTAs scroll to `#contact`.
  **[CONFIRM: or to Sign up]**

### 8 · Pricing: "Choose how you glow" (light, soft rose wash, new on Home)

- **Eyebrow:** "GLOWBAL PACKAGES" · **Title:** "Choose how you **glow** on your
  study-abroad journey" ("glow" in rose) · **Subtitle:** "Don't go alone.
  GlowBal guides you from university selection to final submission."
- **Offer pill:** a `-50%` rose badge plus "Launch Offer · 2026 Application
  Season · Valid for all packages"
- **Three cards, in this order: Starter | Yearly Premium (centre) | Yearly.**
  The centre card is raised, has a rose border and carries a ribbon
  "Most chosen" (the PDF shows a percentage here; leave "[XX]% choose this" as
  a visible placeholder, **[CONFIRM]**).
  1. **GlowBal Starter — Free\*** — Access university & major research tools ·
     Discover best-fit scholarship opportunities · Get free 1-on-1 personalised
     expert advice — `Get Free` (secondary). The asterisk needs a footnote
     under the cards. **[CONFIRM its text]**
  2. **GlowBal Yearly Premium — 4.49M ₫/year** · "≈ 375K ₫/month"
     **[CONFIRM: the PDF says 275K, but 4.49M ÷ 12 = 374K]** — "Everything in
     Yearly, plus end-to-end human mentorship" · Full application package
     review by human experts · Dedicated scholarship strategy with our in-house
     team · Priority 1-on-1 support throughout the process · 3 free 1-on-1
     sessions with Scholarship Mentors — `Get Yearly Premium Plan` (primary)
  3. **GlowBal Yearly — 2.49M ₫/year** · "≈ 207K ₫/month" — "Everything in
     Starter, plus full AI tools & mentor support" · Unlimited personalised
     roadmaps & university lists · 24/7 AI Companion & scholarship matching ·
     Unlimited CV/SOP AI review · 1 free 1-on-1 session with a Scholarship
     Mentor · Full application progress tracking — `Get Yearly Plan` (primary)
- **Proposal:** show the pre-discount price struck through above each paid
  price (8.98M → 4.49M, 4.98M → 2.49M). The checkout already uses those
  anchors, and a "-50%" claim needs a reference point.
- Keep each card to its main benefits plus one clear CTA (the PDF asks for this).
- **Interaction:** every package CTA scrolls to `#contact` and **pre-selects
  that package in the form**, with a brief highlight on the selection (see §9,
  state "pre-filled").
- **Mobile:** a horizontal snap carousel that opens centred on Premium, with
  dots.

### 9 · Free Consultation Form (light), anchor `#contact`

- **Left column:** the team photo card (the attached Venture X Demo Day
  photo), radius 12, with a blurred dark caption bar: "The GlowBal team" /
  "Start with a dream university. Leave with a scholarship plan." This exists
  today.
- **Right column:**
  - Contact icon disc.
  - **Title:** "Register for Free Scholarship Consultation with GlowBal
    Mentors"
  - **Subtitle:** "Tell us about your goals. The GlowBal team will contact you
    to help identify a suitable next step."
  - **Fields, in order:**
    1. **Full name\*** (one field). On desktop it shares a row with the next
       field.
    2. **Date of birth\*** (a date input, dd/mm/yyyy) **[CONFIRM vs "Birth
       year"]**
    3. **Email address\*** (placeholder "you@example.com")
    4. **Phone number\***: a dial-code select (VN +84 by default, plus US,
       UK, AU) and the number. The sales team calls, so it is required.
    5. **Where would you like to study?\***: a searchable combobox that
       accepts **a country or an institution name**, with suggestions grouped
       under "Countries" and "Universities".
    6. **Study-abroad budget**: a select with the options: Choose… · Under 300
       million VND (< 300 triệu VND) · 300–500 million VND · 500–800 million
       VND · Over 800 million VND (> 800 triệu VND)
    7. **Choose your GlowBal package**: **3 compact radio cards** rather than a
       dropdown, so a pre-selected package is visible: GlowBal Starter (Free) ·
       GlowBal Yearly (2.49M ₫/year) · GlowBal Yearly Premium (4.49M ₫/year).
       Single choice.
    8. A checkbox: "You agree to our friendly **privacy policy**." (the phrase
       is a link)
    9. **Submit:** `Request Consultation` (primary, full width, xl)
  - **Under the form, a contact row:** Facebook "GlowBal Education" (link) ·
    phone **091 155 20 05** (click-to-call) · a **Zalo** button that opens Zalo
    chat **[CONFIRM: whose Zalo number/OA; the PDF sentence is cut off]**
- **States to draw:**
  - empty
  - focused field
  - inline validation errors (required field, bad email, consent missing)
  - **pre-filled from Pricing** (the package card is selected and rose-ringed,
    with a small note "You picked GlowBal Yearly — change anytime")
  - **pre-filled for a signed-in user** (name and email come from the account)
  - submitting (button shows a spinner and "Sending…")
  - server error (a banner above the button)
  - rate-limited ("Too many requests, try again in a minute")
  - **success**, where the form is replaced by a panel with a check icon and
    the heading "You're registered!", in **two variants:**
    - **(a) visitor with no account:** "We've emailed {email}. A GlowBal mentor
      will contact you shortly. Create your free account with this email to
      unlock free scholarship & university search." Action `Sign up free`.
    - **(b) signed-in, pending user:** "We've emailed {email}. Sign in again to
      unlock free scholarship & university search." Action `Sign in again`.

### Extra board A: access-pending surfaces (Nav state B)

- The rose strip under the nav (described in §0).
- A **gate card**, for a pending user who reaches a locked page such as
  /scholarships. Centred card on a light page, with a lock icon: "Unlock free
  scholarship & university search" / "Fill in the 1-minute consultation form
  on the Home page — access is granted automatically." Action `Go to the
  form`, which links to /#contact.

### Extra board B: confirmation email (600px wide)

Sent right after the form is submitted.

- **Layout:** GlowBal logo, heading "Congratulations — you're registered!",
  and a short body: "Thanks, {first name}. A GlowBal mentor will contact you
  shortly about your consultation. Your free access to scholarship and
  university search is ready — sign in to start." Action `Sign in to GlowBal`
  (rose). Then a small summary of what they submitted (destination, budget,
  package), and a footer with Facebook, phone and Zalo.
- For visitors with no account, the button reads `Create your free account`.
- Draw an EN and a VI version. Use simple table-safe email styling: web fonts
  fall back to Arial, and no CSS effects.

---

## 5. Content rules

- **Never invent facts.** No made-up statistics, testimonials, logos, response
  times ("within 24h"), awards or user counts. If something is missing, use a
  **visibly marked placeholder** such as `[photo: Nguyễn Khánh Linh]` or `[XX]%`.
- **Real people:** do not generate or alter faces of named students or mentors.
  Use the attached photos, or labelled neutral placeholders and initials
  avatars.
- **University names and logos:** use real names. If a logo is not attached,
  use a neutral wordmark placeholder, never a redrawn or imitation crest.
- **Copy:** use this brief's strings verbatim. Light grammar fixes are fine
  and already applied here. Spelling is British ("personalised"), matching the
  rest of the site.
- **Numbers:** use the figures given here. Anything marked [CONFIRM] must
  appear with a small annotation in the mockup so it cannot ship by accident.

---

## 6. Deliverables

1. **Full page, desktop 1440**, all sections in order, in Nav state A.
2. **Full page, mobile 390**, the same.
3. **State boards:**
   - Nav A / B / C, plus the mobile drawer for each.
   - Showcase with the preview closed and open, plus card hover.
   - Success stories: featured card with video and without; one quote
     expanded.
   - Team: centre card for #2, #1 (expanded `+N more`) and #9; the mobile card.
   - Journey: mobile timeline.
   - Features: video poster and fallback mock.
   - Pricing: hover, and the mobile carousel.
   - Form: every state in §9, including both success variants.
   - Extra board A (pending strip and gate card) and B (email, EN and VI).
4. **VI check:** Hero, Nav A, the Premium pricing card and the form, in
   Vietnamese at 1440 and 390, to prove the layout survives longer strings.
5. **Hand-off notes for each section** (a short annotation next to each frame)
   covering:
   - band tone
   - vertical padding token
   - components and their variants (e.g. `Button primary xl`, `Badge`,
     `Input`, `Select`, `Checkbox`)
   - interactions and motion
   - any new component you had to introduce, with the reason

**Motion** (annotate it; don't just imply it): scroll-reveal fades,
number count-up, cover-flow easing, the journey connector, and hover lifts.
Everything must have a reduced-motion fallback: no autoplay, no parallax, and
the globe shows a still frame.

**Accessibility:** WCAG AA contrast on both bands, visible focus rings (rose,
2px), touch targets of at least 44px, a visible label on every form field (not
placeholder-only), and carousels operable by keyboard.

**Creative latitude:** the owner finds faithful but flat builds "boring" and
invites invention. Motion, depth, hover states and small rose accents are
welcome **inside the tokens above**. Mark every addition that goes beyond this
brief as **"Proposal"** in its annotation, so it can be accepted or dropped.

---

## Appendix (for the owner and Claude Code, not for Claude Design): open [CONFIRM] items

| # | Conflict | Brief's default |
|---|---|---|
| 1 | Showcase: "900+" universities (PDF text) vs "200+" (PDF screenshot and live site) | 200+ |
| 2 | Quỳnh Chi VinUni scholarship: 100% (text) vs 90% (screenshot); the "Ph - 100%." prefix looks like a typo | 100%, prefix dropped |
| 3 | Metric 2: "Scholarships" (text) vs "Scholarship searches run" (screenshot) | searches run |
| 4 | Metric 3 verb: "Invested by" implies equity. The PDF also calls it "support", and a competition prize is not an investment | "Backed by" |
| 5 | Regular users 413 (PDF) vs 370 (live) | 413 |
| 6 | **Pricing vs checkout (`src/lib/plus.ts`):** checkout sells Monthly 349K / Yearly (3 mentor sessions) / Premium (5 sessions). The PDF sells Free Starter / Yearly (1 session) / Premium (3 sessions). The PDF itself says the two must match exactly | Brief uses the PDF. **Checkout must be changed to match, or the PDF corrected** |
| 7 | Premium per-month: 275K (screenshot) vs 374K (arithmetic) | ≈ 375K |
| 8 | "Free\*" asterisk has no footnote; the "% chose" ribbon has no figure | placeholders |
| 9 | Form: Full name + Date of birth (text) vs First name + Birth year (screenshot) | Full name + DOB |
| 10 | Zalo: whose number/OA? (the sentence is cut off) | placeholder |
| 11 | **Flow gap:** a visitor with no account can submit the form, but the PDF's email says "sign in again", which only makes sense for someone already signed up | two success variants |
| 12 | Feature CTAs for guests: to the form, or to Sign up? | form |
| 13 | Khánh Linh intro "With passion…" is unfinished; Quỳnh Chi's intro carries the note "viết ngắn lại cho tôi" (shorten it) | no intro / shortened draft |
| 14 | Removing FAQ, pain points, 5-step how-it-works and scholarship pillars from Home (they are not in the PDF flow) | removed |

**Found while screenshotting the live site (2026-09-27), for Claude Code:**

- Screenshots of the live Home are in `C:\Users\Tlinh\Downloads\glowbal-home-current\`
  (`desktop-1440/`, `mobile-390/`, one file per section).
- **The live site is behind `main`.** The library preview (commit `3837d4eb`)
  is not deployed, and "Find scholarships" still links to `/scholarships`.
- **Live mobile bug:** the Standout-numbers heading and quote are washed out at
  390px. A 360px decorative rose glow (`aria-hidden`, `absolute`,
  `bg-brand-subtle opacity-70 blur-3xl` in `home-metrics.tsx`) paints over the
  heading, because the heading's wrapper is not positioned. Desktop is
  unaffected because the glow sits off to the left there. Fix while rebuilding
  §4: give the content `relative z-*` or put the glows at `-z-10`.
- **Live Home shows the scholarship-spotlight empty state** ("Find
  scholarships that fit your goals"), which renders only when
  `homeHighlights(6)` returns 0 rows. The cause is not verified. It may be
  related to the Supabase 402 on the old project (see current-status.md), or
  to the 12h `unstable_cache`. Check this before relying on
  `scholarshipSpotlight` for the new library preview.
- Team members have **no portraits** on the live site; the cards show
  initials. Photos must come from the owner.
- Quỳnh Chi's team card on the live site says **"90% merit scholarship"**,
  which supports the 90% in the PDF screenshot for item #2.
