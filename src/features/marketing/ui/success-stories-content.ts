/**
 * Success Stories — the content. Kept out of the component because every line
 * of it is a real, named person, and because the people who will edit it next
 * are not engineers.
 *
 * ⚠️ THIS FILE IS REAL PERSONAL DATA, NOT SAMPLE DATA. Eight named students,
 * seven of them identified by their school as well. It was supplied by the
 * owner on 2026-09-20 specifically for publication on "/", so consent is the
 * owner's to hold — but that also means:
 *
 *   - Nothing here may be copied into `docs/`. AGENTS.md forbids personal data
 *     in documentation, and that rule has no marketing exception.
 *   - Removing a student is deleting their entry. The section counts its own
 *     content (see `SUCCESS_STORY_VOICES.length` in home-success-stories.tsx),
 *     so no prose has to be rewritten to match.
 *   - Do NOT add the email addresses that sit beside some of these names in
 *     sql/supabase-team-members-seed.sql. They are not needed to render a
 *     quote.
 *
 * ─── WHY BOTH LANGUAGES ARE WRITTEN OUT ──────────────────────────────────────
 *
 * Every other string on Home is English at the source and reaches Vietnamese
 * through `getLocaleText` / DomTranslator, which machine-translates EN→VI.
 * These quotes run the other way: the students spoke Vietnamese, and that IS
 * the artefact. So each carries `vi` (verbatim, exactly as given) and `en` (a
 * hand translation), and the rendered node is marked `data-no-auto-translate`
 * so the machine translator never touches either one. Feeding Vietnamese into
 * an EN→VI translator would spend an API call to paraphrase a real person's
 * words back at them.
 *
 * ⚠️ THE VIETNAMESE IS VERBATIM AND MUST STAY THAT WAY, punctuation included.
 * `:)))` and `=))))` are not typos and not damage — they are how this age group
 * writes, and they are most of why these read as students rather than as
 * marketing copy. The arrows in Minh Anh's quote are hers too. Tidying any of
 * it would cost the section the only thing it has that a testimonial generator
 * does not. The `en` side is a translation and may be revised freely; the `vi`
 * side may only be changed by the person who said it.
 */

/** One student's award, as one row of the ledger on the feature card. */
export type SuccessStoryAward = {
  /**
   * The institution that made the offer. Expanded from the owner's shorthand
   * where the short form would not be recognised outside Vietnam — "BUV" →
   * "British University Vietnam", "Lingnan Uni" → "Lingnan University",
   * "RMIT" → "RMIT University". The awards themselves are NOT expanded or
   * corrected; "Vice Chancellor Scholarship" is the owner's wording and stays.
   */
  readonly institution: string;
  /**
   * The size of the award, when it has one worth setting large — "100%",
   * "Full". `null` for the two named awards whose value the owner did not give,
   * and those rows simply leave the gutter empty. Nothing is invented to fill
   * it: this is a section about real offers, on a page whose headline figures
   * are already marketing (see partner-scholarship-value.ts), and inventing a
   * percentage here would be a different and much worse kind of claim.
   */
  readonly magnitude: string | null;
  /** The award's name, as given. */
  readonly award: string;
  /**
   * True for the one she enrolled at. Supported by two owner-supplied sources
   * that agree: the roster in home-team.tsx has her reading Business
   * Administration at VinUniversity, and the VinUniversity award below is for
   * exactly that course. It is still an inference rather than something she
   * said, so it is one flag on one row — delete the line to remove the marker
   * and nothing else changes.
   */
  readonly enrolled: boolean;
};

export type SuccessStory = {
  readonly name: string;
  /** Vietnamese first, because that is the audience reading it. */
  readonly summary: { readonly vi: string; readonly en: string };
  readonly awards: readonly SuccessStoryAward[];
};

/**
 * The feature story.
 *
 * ⚠️ 100% vs 90% — UNRESOLVED CONFLICT WITH home-team.tsx, RAISED WITH THE
 * OWNER 2026-09-20. Her roster card in that file reads "90% merit scholarship ·
 * full ride at Lingnan"; the copy below, supplied later, says 100% at
 * VinUniversity. Both render on "/", roughly two screens apart, so as things
 * stand the page states two different numbers for one award. This file uses the
 * newer figure because it is the one the owner sent last, and home-team.tsx was
 * deliberately NOT edited to match — which of the two is correct is a question
 * about a real scholarship, not a merge conflict to resolve by guessing. When
 * the owner rules, fix the other file and delete this note.
 */
export const SUCCESS_STORY_FEATURE: SuccessStory = {
  name: 'Phạm Quỳnh Chi',
  summary: {
    vi: 'Năm trường cấp học bổng, trong đó hai suất toàn phần.',
    en: 'Five universities offered her funding — two of them in full.',
  },
  awards: [
    {
      institution: 'VinUniversity',
      magnitude: '100%',
      award: 'Merit-based Scholarship · Bachelor of Business Administration',
      enrolled: true,
    },
    {
      institution: 'Fulbright University Vietnam',
      magnitude: '100%',
      award: 'Scholarship',
      enrolled: false,
    },
    {
      institution: 'RMIT University',
      magnitude: null,
      award: 'Vice Chancellor Scholarship',
      enrolled: false,
    },
    {
      institution: 'British University Vietnam',
      magnitude: null,
      award: 'Education Development Scholarship',
      enrolled: false,
    },
    {
      institution: 'Lingnan University',
      magnitude: 'Full',
      award: 'Scholarship',
      enrolled: false,
    },
  ],
};

export type SuccessStoryVoice = {
  readonly name: string;
  /** `null` for the one student whose school the owner did not give. */
  readonly school: string | null;
  readonly quote: { readonly vi: string; readonly en: string };
};

/**
 * The wall of voices.
 *
 * Order is the owner's and is not sorted — not by length, not alphabetically.
 * The column layout balances heights on its own, and re-ranking students by how
 * quotable they are is a judgement this file should not be making.
 */
export const SUCCESS_STORY_VOICES: readonly SuccessStoryVoice[] = [
  {
    name: 'Nguyễn Hoàng Minh Anh',
    school: 'THPT Lê Quý Đôn, TP HCM',
    quote: {
      vi: 'Với em, GlowBal là nơi tổng hợp thông tin của Facebook và Threads :))) Vì những bạn tự chuẩn bị hồ sơ như em lúc nào cũng lock in vào những bài feed, đọc chia sẻ, cố gắng tìm bài luận mẫu,... để tự định hướng và gom thông tin. GlowBal sẽ giúp ngay từ bước đầu khi chắt lọc sẵn thông tin về trường → học bổng → quy trình apply → và các thông tin liên quan. GlowBal được xây dựng dựa trên kinh nghiệm từ các anh chị nên em cảm giác những khó khăn mà em đang gặp phải thì GlowBal sẽ giải quyết được.',
      en: 'To me GlowBal is everything Facebook and Threads have, gathered in one place :))) Students who put their own applications together, like me, are permanently locked into the feed — reading other people’s stories, hunting for a sample essay, trying to work out our own direction. GlowBal does that filtering from the very first step: university → scholarship → how to apply → everything around it. It is built on what the students ahead of us went through, so I get the feeling the problems I am hitting right now are ones GlowBal can actually solve.',
    },
  },
  {
    name: 'Nguyễn Ngọc Khánh Linh',
    school: 'THPT Chuyên Bến Tre',
    quote: {
      vi: 'GlowBal có tổng hợp thông tin về các trường đại học trên thế giới nên em cảm thấy mình có thể tiết kiệm thời gian và đỡ lan man hơn. Nhờ có chức năng này mà em cũng cân nhắc được thêm vài quốc gia, trường và ngành học mà trước đây em chưa từng nghĩ đến. Em sẽ mô tả GlowBal là một web hỗ trợ tìm kiếm học bổng mới lạ và hữu ích nhất mà em từng trải nghiệm, đặc biệt còn có các tính năng như lên kế hoạch apply, hỗ trợ xây dựng CV và bài luận như một mentor.',
      en: 'GlowBal pulls together information on universities all over the world, so I save time and wander off course a lot less. Because of it I am now considering a few countries, universities and subjects I had never once thought about. I would describe GlowBal as the freshest and most useful scholarship search I have used — and on top of that it plans the application, and helps with the CV and the essays the way a mentor would.',
    },
  },
  {
    name: 'Trần Hoàng Lê Thành',
    school: 'THPT Chuyên Ngoại ngữ, Hà Nội',
    quote: {
      vi: 'Yếu tố ăn khách nhất của GlowBal bây giờ là scholarship matching, và em thấy rằng không nhiều học sinh nghĩ đến học bổng một cách chi tiết và hoàn thiện như vision của GlowBal.',
      en: 'The thing that sells GlowBal right now is the scholarship matching. Not many students think about scholarships in that much detail, or that completely, compared with GlowBal’s vision of it.',
    },
  },
  {
    name: 'Đinh Thành Minh',
    school: 'Vinschool Ocean Park 1',
    quote: {
      vi: 'GlowBal là một web/app giúp tìm trường phù hợp, tạo lộ trình và theo sát tiến trình.',
      en: 'GlowBal is a site and an app that finds the universities that fit you, builds the route, and stays with you along it.',
    },
  },
  {
    name: 'Nguyễn Hoàng Bảo Minh',
    school: 'The Dewey Schools THT',
    quote: {
      vi: 'Em ấn tượng với bảng profile của GlowBal vì nó được làm rất chỉn chu và đáp ứng tất cả những thứ em cần. Với em, đây là một web định hướng du học rất chất lượng do chính người Việt làm ra.',
      en: 'The profile board impressed me — it is put together carefully and it covers everything I need. To me this is a genuinely high-quality study-abroad site, and it was made by Vietnamese people themselves.',
    },
  },
  {
    name: 'Hà Trung Khải',
    school: 'Vinschool Smart City, Hà Nội',
    quote: {
      vi: 'Mặc dù chưa trải nghiệm quá nhiều để hiểu hết về GlowBal, em vẫn thấy ấn tượng về mục tiêu mà team hướng tới vì nó đem lại giá trị thực sự cho người tìm đến GlowBal. Vào đây chọn gói cao nhất, không quá đắt mà team vẫn xịn, chăm sóc hết từ đầu đến cuối =))))',
      en: 'I have not used it enough to understand all of GlowBal yet, but I am still impressed by what the team is aiming at, because it brings real value to whoever comes to it. Go in, take the top package — it is not that expensive, the team is still excellent, and they look after you from start to finish =))))',
    },
  },
  {
    name: 'Nguyễn Uyên Nhi',
    school: null,
    quote: {
      vi: 'Em siêu thích phần định hướng dựa trên personal accounts, cảm giác em được nhìn nhận đúng hơn về mình và biết cách để mình lựa chọn môi trường phù hợp nhất.',
      en: 'I really love the part that works out your direction from your personal account. I feel like I am seen more accurately, and like I know how to choose the environment that suits me best.',
    },
  },
];
