/**
 * Owner-supplied content for the sales-journey Home (design handoff
 * `design_handoff_home_redesign/`, brief
 * `docs/plans/2026-09-27-home-sales-journey-design-brief.md`).
 *
 * English strings are the source and double as the keys for their Vietnamese in
 * src/lib/i18n-home.ts. The student quotes are the exception: Vietnamese is the
 * ORIGINAL there, so each quote carries both languages itself rather than
 * routing the real words through a translation lookup.
 *
 * ⚠️ NOTHING HERE MAY BE INVENTED. Every achievement, quote, figure and price is
 * from the owner's PDF / brief. Where the brief marks a value [CONFIRM], the
 * brief's default is used and the open question is recorded in
 * docs/current-status.md — not on the page.
 */
import type { ConsultationPackage } from './consultation';

/* ── 3 · Success stories ───────────────────────────────────────────────── */

/** Phạm Quỳnh Chi's featured card. [CONFIRM] VinUni 100% (text) vs 90% (screenshot) — brief default 100%. */
export const FEATURED_STORY = {
  name: 'Phạm Quỳnh Chi',
  portrait: '/home/team/pham-quynh-chi.webp',
  achievements: [
    '100% Merit-based Scholarship for Bachelor of Business Administration — VinUniversity',
    '100% Scholarship — Fulbright University',
    'Vice Chancellor Scholarship — RMIT',
    'Education Development Scholarship — BUV',
    'Full Scholarship — Lingnan University',
  ],
  /**
   * University marks along the foot of the card. Only VinUniversity has a logo
   * file in the repo; the rest render as neutral name chips rather than a
   * redrawn crest (brief §5: never an imitation logo).
   */
  schools: [
    { name: 'VinUniversity', logo: '/universities/vinuniversity.png' },
    { name: 'Fulbright University', logo: null },
    { name: 'RMIT', logo: null },
    { name: 'BUV', logo: null },
    { name: 'Lingnan University', logo: null },
  ],
  /**
   * The story video does not exist yet. The card is built video-ready — set a
   * source here and the play button and "Watch Chi's story" chip appear.
   */
  video: null as { readonly src: string; readonly type: 'video/mp4' | 'video/webm' } | null,
} as const;

export type StudentQuote = {
  readonly name: string;
  /** School and city as the PDF gives them. Empty when the student gave none — the line is then omitted, not filled. */
  readonly school: string;
  readonly initials: string;
  /** Owner-supplied portrait. Null only when the handoff contains no match. */
  readonly portrait: string | null;
  /**
   * CSS `object-position` for the SQUARE crop the PDF asks for ("ảnh (dạng
   * vuông)"). The supplied photos are a mix of portrait and landscape, so each
   * one is aimed at the face by hand; checked on a contact sheet 2026-09-29.
   */
  readonly focus: string;
  /** The student's own words. */
  readonly vi: string;
  /** Draft translation, shown with a "Translated from Vietnamese" note. */
  readonly en: string;
};

/**
 * Real students, verbatim, in the order of the owner's content PDF
 * (`specific-redesign/Customer Journey for Sales _ GlowBal (3).pdf`, §3).
 *
 * ⚠️ The Vietnamese is copied from THAT PDF, character for character. The
 * first v2 build had taken the quotes from the earlier design brief, which had
 * trimmed four of them (Minh Anh's VinUni sentence, Khánh Linh's "Vì em chưa
 * biết…" and closing clause, Hoàng Yến's "điều mà trước giờ…", Thành Minh's
 * "check CV") and used an older wording of Trung Khải's. Restored 2026-09-29.
 * Do not shorten a quote to fit a card — the card clamps and offers Read more.
 */
export const STUDENT_QUOTES: readonly StudentQuote[] = [
  {
    name: 'Nguyễn Hoàng Minh Anh',
    school: 'THPT Lê Quý Đôn, TP HCM',
    initials: 'MA',
    portrait: '/home/testimonials/nguyen-hoang-minh-anh.webp',
    focus: '45% 78%',
    vi: 'Với em, GlowBal là nơi tổng hợp thông tin của Facebook và Threads :))) Vì những bạn tự chuẩn bị hồ sơ như em lúc nào cũng lock in vào những bài feed, đọc chia sẻ, cố gắng tìm bài luận mẫu,... để tự định hướng và gom thông tin. GlowBal sẽ giúp ngay từ bước đầu khi chắt lọc sẵn thông tin về trường → học bổng → quy trình apply → và các thông tin liên quan. Vì em lựa chọn theo đuổi học bổng VinUni nên cách web hỗ trợ breakdown những câu hỏi để em có thể reflect bản thân dựa theo sát những tiêu chí của VinUni đã giúp em rất nhiều để có cái nhìn tổng quát và có những ý tưởng ban đầu cho phần viết luận hay chuẩn bị hồ sơ. GlowBal được xây dựng dựa trên kinh nghiệm từ các anh chị nên em cảm giác những khó khăn mà em đang gặp phải thì GlowBal sẽ giải quyết được.',
    en: "For me, GlowBal pulls together everything I used to dig for on Facebook and Threads :))) Students who prepare their applications alone, like me, are always locked into feeds, reading people's stories and hunting for sample essays just to find a direction. GlowBal helps from the very first step by filtering the information for you: universities → scholarships → the application process → everything around it. Because I chose to pursue the VinUni scholarship, the way the site breaks the questions down so I can reflect on myself against VinUni's own criteria helped me a lot — it gave me the big picture and my first ideas for the essay and the rest of my application. It's built on the experience of older students, so I feel the problems I'm facing are ones GlowBal can solve.",
  },
  {
    name: 'Nguyễn Ngọc Khánh Linh',
    school: 'THPT Chuyên Bến Tre',
    initials: 'KL',
    portrait: '/home/testimonials/nguyen-ngoc-khanh-linh.webp',
    focus: '50% 40%',
    vi: 'GlowBal có tổng hợp thông tin về các trường đại học trên thế giới nên em cảm thấy mình có thể tiết kiệm thời gian và đỡ lan man hơn. Vì em chưa biết bản thân thích quốc gia nào, trường nào, nhờ có chức năng này mà em cũng cân nhắc được thêm vài quốc gia, trường và ngành học mà trước đây em chưa từng nghĩ đến. Em sẽ mô tả GlowBal là một web hỗ trợ tìm kiếm học bổng mới lạ và hữu ích nhất mà em từng trải nghiệm. Đặc biệt, web còn có các tính năng như lên kế hoạch apply, hỗ trợ xây dựng CV và bài luận như một mentor, đây là điều mà khó có thể tìm thấy ở các web khác.',
    en: "GlowBal brings together information on universities around the world, so I save time and stay focused. Since I didn't yet know which country or university I liked, this helped me consider a few countries, universities and majors I had never thought of. I'd describe GlowBal as the most novel and useful scholarship-search site I've ever used. It also has application planning and CV and essay support, like a mentor — something that's hard to find on other sites.",
  },
  {
    name: 'Dương Hoàng Yến',
    school: 'Hà Nội',
    initials: 'HY',
    portrait: '/home/testimonials/duong-hoang-yen.webp',
    focus: '70% 50%',
    vi: "Em sẽ nói GlowBal giống như người mentor khách quan nhất mà em từng có trong quá trình chuẩn bị hồ sơ. Thay vì chỉ gạch chân lỗi ngữ pháp như những công cụ sửa bài em từng dùng trước đây, GlowBal chấm dựa trên đúng tiêu chí tuyển sinh của từng trường em nộp — nghĩa là em không chỉ biết 'câu này sai' mà biết 'câu này chưa đáp ứng được điều trường X đang tìm kiếm ở ứng viên'. Nó còn đi từng câu một để chỉ ra các câu có đang thực sự liên kết với nhau và với chủ đề chính hay không, điều mà trước giờ em chưa bao giờ tự nhìn ra được khi tự đọc lại bài của chính mình. Nhưng thứ khiến em ấn tượng nhất lại là phần personal reflection. Nó không dừng ở việc 'sửa bài luận cho hay hơn' mà thực sự cố gắng hiểu em là ai, em đang hướng tới điều gì.",
    en: "I'd say GlowBal is the most objective mentor I've had while preparing my application. Instead of just underlining grammar mistakes like the editing tools I used before, GlowBal marks my writing against the admissions criteria of each university I apply to — so I don't only learn 'this sentence is wrong', but 'this sentence doesn't yet show what University X looks for in an applicant'. It also goes sentence by sentence to show whether each one really connects to the others and to the main theme, something I had never been able to see when rereading my own essay. But what impressed me most was the personal reflection. It doesn't stop at 'making the essay better' — it genuinely tries to understand who I am and where I'm heading.",
  },
  {
    name: 'Nguyễn Hoàng Bảo Minh',
    school: 'The Dewey Schools THT, Hà Nội',
    initials: 'BM',
    portrait: '/home/testimonials/nguyen-hoang-bao-minh.webp',
    focus: '45% 30%',
    vi: 'Em ấn tượng với bảng profile của GlowBal vì nó được làm rất chỉn chu và đáp ứng tất cả những thứ em cần. Với em, đây là một web định hướng du học rất chất lượng do chính người Việt làm ra.',
    en: "I was impressed by GlowBal's profile dashboard — it's carefully made and covers everything I need. To me it's a genuinely high-quality study-abroad guide, made by Vietnamese people.",
  },
  {
    name: 'Nguyễn Uyên Nhi',
    school: '',
    initials: 'UN',
    portrait: null,
    focus: '50% 50%',
    vi: 'Em siêu thích phần định hướng dựa trên personal accounts, cảm giác em được nhìn nhận đúng hơn về mình và biết cách để mình lựa chọn môi trường phù hợp nhất.',
    en: 'I love the guidance built on personal accounts — I feel seen more accurately, and I know how to choose the environment that suits me best.',
  },
  {
    name: 'Trần Hoàng Lê Thành',
    school: 'THPT Chuyên Ngoại ngữ, Hà Nội',
    initials: 'LT',
    portrait: '/home/testimonials/tran-hoang-le-thanh.webp',
    focus: '55% 22%',
    vi: 'Yếu tố ăn khách nhất của GlowBal bây giờ là scholarship matching, và em thấy rằng không nhiều học sinh nghĩ đến học bổng một cách chi tiết và hoàn thiện như vision của GlowBal.',
    en: "GlowBal's biggest draw right now is scholarship matching — and not many students think about scholarships in as much detail, or as completely, as GlowBal's vision does.",
  },
  {
    name: 'Đinh Thành Minh',
    school: 'Vinschool Ocean Park 1',
    initials: 'TM',
    portrait: '/home/testimonials/dinh-thanh-minh.webp',
    focus: '50% 88%',
    vi: 'GlowBal là một web/app giúp tìm trường phù hợp, tạo lộ trình, theo sát tiến trình và có thể check CV của em.',
    en: 'GlowBal is a web app that helps you find the right university, build a roadmap, stay on top of your progress — and it can check my CV.',
  },
  {
    name: 'Hà Trung Khải',
    school: 'Vinschool Smart City, Hà Nội',
    initials: 'TK',
    portrait: '/home/testimonials/ha-trung-khai.webp',
    focus: '50% 14%',
    vi: 'Em thấy ấn tượng về mục tiêu mà team hướng tới vì GlowBal đem lại giá trị thực sự cho người tìm đến. Vào đây chọn gói cao nhất, không quá đắt mà team vẫn xịn, chăm sóc hết từ đầu đến cuối =))))',
    en: "I'm impressed by what the team is aiming for, because GlowBal brings real value to the people who come to it. Pick the top plan here: it isn't too expensive, the team is great, and they look after you from start to finish =))))",
  },
];

/**
 * The server's first guess at which quotes overflow the card's six lines. The
 * card then MEASURES the real clamp in the browser (home-stories.tsx), so this
 * only decides the first paint's "Read more" links.
 */
export const QUOTE_CLAMP_CHARS = 230;

/* ── 6 · Your GlowBal journey ──────────────────────────────────────────── */

/**
 * "How to 'Hunt Scholarship' with GlowBal?" — the four steps exactly as the
 * content PDF (3) orders and words them. The earlier brief's version (Discover
 * Your Direction · Matcher · Strategy Master · Receive 1-on-1 Support, under a
 * "Have you ever?" hook) is superseded; the PDF moved the free consultation to
 * step 02 and ends on AI + experts.
 */
export const JOURNEY_STEPS: ReadonlyArray<{
  readonly title: string;
  readonly body: string;
  readonly icon: 'matchingReport' | 'contact' | 'strategyMaster' | 'aiInsight';
}> = [
  {
    title: 'GlowBal Matcher: Unlock Best-Fit Scholarships and Universities',
    body: 'Finish a short quiz to identify high-value scholarships tailored to your profile and your universities.',
    icon: 'matchingReport',
  },
  {
    title: 'Free Consultation',
    body: 'Work closely with dedicated experts who guide and support you through every detail until success.',
    icon: 'contact',
  },
  {
    title: 'Strategy Master: Craft Your Winning Strategy',
    body: 'Build a compelling application strategy, highlighting your unique strengths and showcasing your potential.',
    icon: 'strategyMaster',
  },
  {
    title: 'Conquer your Dream with GlowBal AI and experts',
    body: 'You are not alone, our experts are here to oversee your application with our AI.',
    icon: 'aiInsight',
  },
];

/* ── 8 · Pricing ───────────────────────────────────────────────────────── */

export type PricingPlan = {
  readonly id: ConsultationPackage;
  readonly name: string;
  /** Headline price. `null` renders the localized "Free". */
  readonly price: string | null;
  /** Pre-discount anchor, struck through (design PROPOSAL; checkout uses the same anchors). */
  readonly was: string | null;
  /** Per-month equivalent amount, or `null` for the free plan. */
  readonly perMonth: string | null;
  readonly tagline: string | null;
  readonly cta: string;
  readonly primary: boolean;
  readonly featured: boolean;
  /**
   * What the package combines, shown as icons on the card — content PDF (3)
   * §8: Premium shows "icon hình người + GlowBal AI", Yearly "icon AI".
   */
  readonly includes: ReadonlyArray<'mentor' | 'ai'>;
  readonly features: readonly string[];
};

/**
 * Card order is Starter · Premium · Yearly — Premium in the centre, raised.
 *
 * Owner-open items, shipped at the brief's defaults and listed in
 * docs/current-status.md rather than printed on the page:
 *  - Premium per-month: ≈375K is 4.49M ÷ 12; the PDF screenshot says 275K.
 *  - The ribbon's "[XX]% choose this" has no figure, so it reads "Most chosen".
 *  - "Free*" has no footnote text, so the asterisk is omitted.
 *  - Yearly's CTA is primary per brief §8, making two rose buttons in one row.
 */
export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'starter',
    name: 'GlowBal Starter',
    price: null,
    was: null,
    perMonth: null,
    tagline: null,
    cta: 'Get Free',
    primary: false,
    featured: false,
    includes: [],
    features: [
      'Access university & major research tools',
      'Discover best-fit scholarship opportunities',
      'Get free 1-on-1 personalised expert advice',
    ],
  },
  {
    id: 'premium',
    name: 'GlowBal Yearly Premium',
    price: '4.49M ₫',
    was: '8.98M ₫',
    perMonth: '375K ₫',
    tagline: 'Everything in Yearly, plus end-to-end human mentorship',
    cta: 'Get Yearly Premium Plan',
    primary: true,
    featured: true,
    includes: ['mentor', 'ai'],
    features: [
      'Full application package review by human experts',
      'Dedicated scholarship strategy with our in-house team',
      'Priority 1-on-1 support throughout the process',
      '3 free 1-on-1 sessions with Scholarship Mentors',
    ],
  },
  {
    id: 'yearly',
    name: 'GlowBal Yearly',
    price: '2.49M ₫',
    was: '4.98M ₫',
    perMonth: '207K ₫',
    tagline: 'Everything in Starter, plus full AI tools & mentor support',
    cta: 'Get Yearly Plan',
    primary: true,
    featured: false,
    includes: ['ai'],
    features: [
      'Unlimited personalised roadmaps & university lists',
      '24/7 AI Companion & scholarship matching',
      'Unlimited CV/SOP AI review',
      '1 free 1-on-1 session with a Scholarship Mentor',
      'Full application progress tracking',
    ],
  },
];

/* ── 9 · Consultation form ─────────────────────────────────────────────── */

/**
 * Suggestions for "Where would you like to study?". Countries are the
 * destinations the scholarship catalogue actually covers (measured 2026-09-27,
 * most-linked first); universities are the eleven in the partner orbit. The
 * field still accepts anything typed — these only save keystrokes.
 */
export const DESTINATION_COUNTRIES: readonly string[] = [
  'United Kingdom',
  'United States',
  'Australia',
  'Canada',
  'China',
  'New Zealand',
  'Ireland',
  'Germany',
  'Singapore',
  'South Korea',
  'Hong Kong',
  'Japan',
  'France',
  'Netherlands',
];
