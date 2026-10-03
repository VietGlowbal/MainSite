import type { UniversityKey } from './university-crests';

/**
 * The Home team carousel's roster — the ten people in the sales-journey brief
 * (§5), in carousel order. Replaces the eight-card roster the Home grid carried.
 *
 * ⚠️ EVERY FACT IS FROM THE OWNER'S BRIEF, verbatim in substance. Five members
 * have no intro, and they get none: the card is built to look complete without
 * one (brief §5 — "Never invent one"). Nguyễn Khánh Linh's supplied intro
 * ("With passion…") is unfinished, so it is withheld rather than truncated.
 * Phạm Quỳnh Chi's is the brief's shortened draft [CONFIRM].
 *
 * Portraits still come from `team_members.photo_url`, matched by slug, exactly
 * as the previous roster did. A member with no stored photo — or one whose image
 * fails to load — shows initials, never a generated face.
 */

export type TeamAchievementCategory =
  | 'Education'
  | 'Scholarship'
  | 'International'
  | 'Advising'
  | 'Research'
  | 'Competition'
  | 'Work';

export type HomeTeamMember = {
  readonly name: string;
  /** First slug with a stored photo wins (some people are seeded under a longer name). */
  readonly photoSlugs: readonly string[];
  /** Owner-supplied v2 portrait. The live DB remains a fallback for missing assets. */
  readonly portrait: string | null;
  readonly role: string;
  readonly studies: string;
  readonly programme: string;
  readonly exchange: string | null;
  readonly intro: string | null;
  /** Crest on the photo chip. `null` falls back to `crestText`. */
  readonly crest: UniversityKey | null;
  readonly crestText: string | null;
  /** The "students guided" stat chip — only for someone with a real figure. */
  readonly stat: { readonly value: string; readonly label: string; readonly detail: string } | null;
  readonly achievements: ReadonlyArray<readonly [text: string, category: TeamAchievementCategory]>;
};

export const HOME_TEAM_ROSTER: readonly HomeTeamMember[] = [
  {
    name: 'James David Lapslie',
    photoSlugs: ['james-lapslie', 'james-david-lapslie'],
    portrait: '/home/team/james-lapslie.webp',
    role: 'Mentor',
    studies: 'University of Birmingham, UK',
    programme: 'Master of Computer Science',
    exchange: null,
    intro: null,
    crest: 'birmingham',
    crestText: null,
    stat: null,
    achievements: [
      ['Finalist, Undergraduate of the Year 2026 (AI category)', 'Competition'],
      ['Semi-finalist, Inter-Campus Enterprise Competition 2025 & 2026', 'Competition'],
      ['Led a team of eight to win the Birmingham Project Award with Siemens UK', 'Competition'],
      ['Led a team of six to complete the Engineering Education Scheme with GKN Automotive', 'Work'],
      ['Vice-President, University Debate Society', 'Education'],
      ['Bronze winner, Birmingham Debate Pro Am 2026', 'Competition'],
      ['Accepted onto the Algoverse 2026 AI research program', 'Research'],
      ['Accepted into the Engineering and Science Leadership Academy 2026', 'Education'],
    ],
  },
  {
    name: 'Nguyễn Khánh Linh',
    photoSlugs: ['nguyen-khanh-linh'],
    portrait: '/home/team/nguyen-khanh-linh.webp',
    role: 'Mentor',
    studies: 'VinUniversity',
    programme: 'Bachelor of Business Administration (80% Merit-based Scholarship)',
    exchange: 'University of Birmingham, UK',
    intro: null,
    crest: 'vinuniversity',
    crestText: null,
    stat: {
      value: '12',
      label: 'students guided to VinUniversity merit scholarships',
      detail: '1 × 100% · 4 × 80% · 7 × 70–75%',
    },
    achievements: [
      ['Represented VinUniversity on exchange at the University of Birmingham, UK', 'International'],
      [
        'Advised 1 × 100%, 4 × 80%, 7 × 70–75% Merit-based Scholarship winners at VinUniversity (incl. CBM, CAS and CECS)',
        'Advising',
      ],
      ["4-time Dean's List Academic Award recipient", 'Education'],
      ['Worked at VinDynamics – Vingroup and Laulau Learning Vietnam', 'Work'],
    ],
  },
  {
    name: 'Nguyễn Hoàng Linh',
    photoSlugs: ['nguyen-hoang-linh'],
    portrait: '/home/team/nguyen-hoang-linh.webp',
    role: 'Mentor',
    studies: 'VinUniversity · Carnegie Mellon University',
    programme: 'Bachelor of Business Administration',
    exchange: 'University of Birmingham, UK',
    intro: null,
    crest: 'vinuniversity',
    crestText: null,
    stat: null,
    achievements: [
      ['80% merit-based scholarship at Carnegie Mellon University', 'Scholarship'],
      ['75% Merit-based Scholarship, VinUniversity', 'Scholarship'],
      ['Represented VinUniversity on exchange at the University of Birmingham, UK', 'International'],
      ['Worked at EY Consulting Vietnam', 'Work'],
    ],
  },
  {
    name: 'Phạm Quỳnh Chi',
    photoSlugs: ['pham-quynh-chi'],
    portrait: '/home/team/pham-quynh-chi.webp',
    role: 'Supporter',
    studies: 'VinUniversity',
    programme: 'Bachelor of Business Administration',
    exchange: null,
    intro:
      'Back at GlowBal in a new role, I bring first-hand experience to help you strengthen your SOP & CV, build a strategic extracurricular profile and map a clear path to your dream universities.',
    crest: 'vinuniversity',
    crestText: null,
    stat: null,
    achievements: [
      ['100% Merit-based Scholarship (BBA) — VinUniversity', 'Scholarship'],
      ['100% Scholarship — Fulbright University', 'Scholarship'],
      ['Vice Chancellor Scholarship — RMIT', 'Scholarship'],
      ['Education Development Scholarship — BUV', 'Scholarship'],
      ['Full Scholarship — Lingnan University', 'Scholarship'],
      ['First Runner-Up, Social Pioneers (Social Marketing Competition)', 'Competition'],
      ['Second Runner-Up, ISME Debate Contest', 'Competition'],
      ['Encouragement Prize, RMIT Business Plan Competition', 'Competition'],
    ],
  },
  {
    name: 'Nguyễn Văn Huấn',
    photoSlugs: ['nguyen-van-huan'],
    portrait: '/home/team/nguyen-van-huan.webp',
    role: 'Technical & Academic Advisor',
    studies: 'Hanoi University of Science and Technology',
    programme: 'Bachelor of Information Technology',
    exchange: null,
    intro:
      'With experience in AI research, innovation, and technology competitions, I help students build a strong academic profile, discover research and STEM opportunities, and navigate program and scholarship applications abroad with greater confidence.',
    crest: 'hust',
    crestText: null,
    stat: null,
    achievements: [
      [
        'First Author, MVA research paper on nighttime vehicle localisation — under review at Neural Computing and Applications (Q1 Scopus)',
        'Research',
      ],
      ['Bronze Prize, FTU Student Scientific Research Competition (Vietnamese NLP sentiment analysis)', 'Research'],
      ['Team Leader, AuraBeam Research Project (AI-powered anti-glare adaptive headlights)', 'Research'],
      ['Top 2 & Top 8, SOICT Technology Showcase (HUST)', 'Competition'],
      ['Top 25, VinUni Datathon', 'Competition'],
      ['Active in research, entrepreneurship and innovation initiatives at HUST', 'Research'],
    ],
  },
  {
    name: 'Tạ Đức Hiển',
    photoSlugs: ['ta-duc-hien'],
    portrait: '/home/team/ta-duc-hien.webp',
    role: 'Technical & Academic Advisor',
    studies: 'Hanoi University of Science and Technology',
    programme: 'Bachelor of Information Technology',
    exchange: null,
    intro:
      'From data/research competitions and academic projects to scholarship positioning, I provide practical guidance to make your profile stronger, more distinctive, and application-ready.',
    crest: 'hust',
    crestText: null,
    stat: null,
    achievements: [
      ['Second Runner-up, HBAAC', 'Competition'],
      ['Top 8 HUST Representatives, G-TIP Competition (South Korea & Malaysia)', 'International'],
      ['Second Runner-up, Data Science Talent Competition 2026', 'Competition'],
      ['Second Prize, Student Scientific Research Competition 2025', 'Research'],
      ['Cumulative GPA 4.0/4.0', 'Education'],
      ['3-time recipient, Academic Encouragement Scholarship', 'Scholarship'],
      ['Outstanding Student Award 2024–2025', 'Education'],
    ],
  },
  {
    name: 'Phùng Thị Hương',
    photoSlugs: ['phung-thi-huong'],
    portrait: '/home/team/phung-thi-huong.webp',
    role: 'Academic & Extracurricular Advisor',
    studies: 'Foreign Trade University',
    programme: 'Bachelor of International Political Economics',
    exchange: null,
    intro:
      'Drawing from my experience in case competitions, research, and extracurricular activities, I can help students discover the right opportunities, build a standout profile, and navigate their study-abroad journey with confidence.',
    crest: 'ftu',
    crestText: null,
    stat: null,
    achievements: [
      ['1st Runner-up, Social Marketing Competition', 'Competition'],
      ['Consolation Prize, WAH Business Case Competition', 'Competition'],
      ['2 conference papers', 'Research'],
      ['2-time recipient, Academic Encouragement Scholarship', 'Scholarship'],
    ],
  },
  {
    name: 'Lý Giai Mẫn',
    photoSlugs: ['ly-giai-man'],
    portrait: null,
    role: 'Academic & Extracurricular Advisor',
    studies: 'VinUniversity · Fulbright University',
    programme: 'Bachelor of Economics',
    exchange: null,
    intro: null,
    crest: 'vinuniversity',
    crestText: null,
    stat: null,
    achievements: [
      ['IELTS Overall 9.0', 'Education'],
      ['VinUniversity Scholarship — 80% tuition', 'Scholarship'],
    ],
  },
  {
    name: 'Chu Tuấn Linh',
    photoSlugs: ['chu-tuan-linh'],
    portrait: '/home/team/chu-tuan-linh.webp',
    role: 'Technical Advisor',
    studies: 'Hanoi University of Science and Technology',
    programme: 'Bachelor of Information Technology',
    exchange: null,
    intro: null,
    crest: 'hust',
    crestText: null,
    stat: null,
    achievements: [
      ['HKUST Top 1% Achiever', 'International'],
      ['Outstanding Achievement in AI & Data Science', 'Education'],
      ['Runner-up, Young Entrepreneurship Competition 2026', 'Competition'],
    ],
  },
  {
    name: 'Nguyễn Tuấn Kiên',
    photoSlugs: ['nguyen-tuan-kien'],
    portrait: '/home/team/nguyen-tuan-kien.webp',
    role: 'Academic & Extracurricular Advisor',
    studies: 'Academy of Finance',
    programme: 'Bachelor of Customs and Logistics',
    exchange: null,
    intro: null,
    // No Academy of Finance logo file exists; the chip shows the name instead.
    crest: null,
    crestText: 'Academy of Finance',
    stat: null,
    achievements: [
      ['Runner-up, Young Entrepreneurship Competition 2026', 'Competition'],
      ['3-time recipient, Academic Encouragement Scholarship', 'Scholarship'],
      ['"5 Good Students" Award 2024–2025', 'Education'],
      ['Top 5 Finalist, Gems of AOF', 'Competition'],
    ],
  },
];

/** The carousel opens on the richest card (#2 — exchange row plus the stat chip). */
export const HOME_TEAM_START_INDEX = 1;

/**
 * The last two words' initials — "Nguyễn Khánh Linh" → "KL" — because a
 * Vietnamese name is addressed by its final words. Same rule as the design and
 * the student-quote avatars (which carry theirs explicitly).
 */
export function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const seed = parts
    .slice(-2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
  return seed === '' ? '?' : seed;
}
