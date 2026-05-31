/**
 * VinUniversity (id=97) dedicated content store.
 *
 * Used exclusively by `/universities/vinuni` (a dedicated rich detail page
 * that bypasses the generic university explorer detail view). Hard-coded
 * here because:
 *   1. Only one university needs this depth of content.
 *   2. Schema changes for one trường would be overkill.
 *   3. Type safety helps the page render conditionally without runtime
 *      validation.
 *
 * Sources: vinuni.edu.vn (public admissions / academic pages).
 */

export type Program = {
  name: string;
  degree: 'Bachelor' | 'Master' | 'Doctorate' | 'Diploma';
  durationYears: number;
  accreditation?: string;
  ranking?: string;
  curriculumHighlights?: string[];
  graduationMode?: 'Thesis' | 'Capstone Project' | 'Exam' | 'Thesis or Capstone';
};

export type College = {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  accent: 'pink' | 'cyan' | 'purple' | 'emerald';
  programs: Program[];
  facilityNotes?: string[];
  facultyLeads?: { name: string; title: string; expertise: string }[];
};

export type Scholarship = {
  name: string;
  coverage: string;
  type: 'merit' | 'need' | 'special' | 'transfer';
  eligibility: string;
  maintainGPA?: string;
  notes?: string;
};

export const vinuniHero = {
  tagline: 'Vietnam’s first non-profit, private, not-for-profit university built to global standards.',
  slogan: 'Ignite Excellence. Build the Future.',
  founded: 2020,
  qsRank: '801–850 (Asia)',
  campusLocation: 'Vinhomes Ocean Park, Gia Lam, Hanoi, Vietnam',
  websiteUrl: 'https://vinuni.edu.vn',
  applyUrl: 'https://apply.vinuni.edu.vn',
  partnerships: ['Cornell University (USA)', 'University of Pennsylvania (USA)'],
};

export const vinuniColleges: College[] = [
  {
    id: 'cbm',
    name: 'College of Business and Management',
    shortName: 'CBM',
    tagline: 'Build the next generation of Vietnam’s business leaders, advised by Cornell SC Johnson College of Business.',
    accent: 'pink',
    programs: [
      {
        name: 'Bachelor of Business Administration',
        degree: 'Bachelor',
        durationYears: 4,
        accreditation: 'Advised by Cornell SC Johnson College of Business',
        curriculumHighlights: [
          'Concentrations: Finance, Marketing, Operations, Entrepreneurship',
          'Mandatory industry internship in year 3',
          'Cross-college minor (CS, Engineering, Health) available',
        ],
        graduationMode: 'Capstone Project',
      },
    ],
    facilityNotes: [
      'Bloomberg Lab with 6 live terminals',
      'Behavioural Insights Lab for consumer research',
    ],
  },
  {
    id: 'cae',
    name: 'College of Arts and Education',
    shortName: 'CAE',
    tagline: 'Cross-disciplinary humanities, design and education programs anchored in critical thinking and creativity.',
    accent: 'purple',
    programs: [
      {
        name: 'Bachelor of Multimedia Communication',
        degree: 'Bachelor',
        durationYears: 4,
        curriculumHighlights: [
          'Studios in motion design, narrative video, brand storytelling',
          'Live industry briefs with VinGroup ecosystem brands',
        ],
        graduationMode: 'Capstone Project',
      },
      {
        name: 'Bachelor of Psychology',
        degree: 'Bachelor',
        durationYears: 4,
        curriculumHighlights: [
          'APA-aligned curriculum',
          'Research methodology + clinical placement track',
        ],
        graduationMode: 'Thesis or Capstone',
      },
      {
        name: 'Bachelor of Economics',
        degree: 'Bachelor',
        durationYears: 4,
        curriculumHighlights: [
          'Quantitative + behavioural economics tracks',
          'Joint electives with CBM finance courses',
        ],
        graduationMode: 'Thesis or Capstone',
      },
    ],
  },
  {
    id: 'cecs',
    name: 'College of Engineering and Computer Science',
    shortName: 'CECS',
    tagline: 'Engineering and computing programs co-developed with Cornell Engineering, focused on industry-grade research.',
    accent: 'cyan',
    programs: [
      {
        name: 'Bachelor of Computer Science',
        degree: 'Bachelor',
        durationYears: 4,
        accreditation: 'Co-designed with Cornell Engineering',
        curriculumHighlights: [
          'Tracks: AI/ML, Cybersecurity, Software Engineering',
          'Mandatory capstone with industry partner',
          'GPU cluster + NVIDIA DGX access for AI labs',
        ],
        graduationMode: 'Capstone Project',
      },
      {
        name: 'Bachelor of Electrical and Computer Engineering',
        degree: 'Bachelor',
        durationYears: 4,
        curriculumHighlights: [
          'Embedded systems + IoT focus',
          'Hardware lab access from year 1',
        ],
        graduationMode: 'Capstone Project',
      },
      {
        name: 'Bachelor of Mechanical Engineering',
        degree: 'Bachelor',
        durationYears: 4,
        curriculumHighlights: [
          'Robotics + EV/automotive track partnered with VinFast',
          'Senior design studio with industry mentors',
        ],
        graduationMode: 'Capstone Project',
      },
      {
        name: 'Bachelor of Data Science',
        degree: 'Bachelor',
        durationYears: 4,
        curriculumHighlights: [
          'Statistics + Machine Learning + Domain electives',
          'Real-world data partnerships (healthcare, finance)',
        ],
        graduationMode: 'Capstone Project',
      },
    ],
    facilityNotes: [
      'NVIDIA DGX AI computing cluster',
      'Maker Studio (3D printing, CNC, electronics bench)',
      'VinFast-sponsored EV powertrain lab',
    ],
  },
  {
    id: 'chs',
    name: 'College of Health Sciences',
    shortName: 'CHS',
    tagline: 'Medicine and nursing programs co-designed with the Perelman School of Medicine, University of Pennsylvania.',
    accent: 'emerald',
    programs: [
      {
        name: 'Medical Doctor (MD)',
        degree: 'Doctorate',
        durationYears: 6,
        accreditation: 'Advised by the Perelman School of Medicine, University of Pennsylvania',
        curriculumHighlights: [
          'Integrated case-based learning from year 1',
          'Clinical rotations at Vinmec International Hospital',
          'Research thesis requirement',
        ],
        graduationMode: 'Thesis',
      },
      {
        name: 'Bachelor of Nursing',
        degree: 'Bachelor',
        durationYears: 4,
        accreditation: 'Advised by Penn Nursing',
        curriculumHighlights: [
          'Simulation hospital training in years 1–2',
          'Clinical placement starts in year 2',
        ],
        graduationMode: 'Capstone Project',
      },
    ],
    facilityNotes: [
      'High-fidelity simulation hospital',
      'Vinmec teaching hospital network',
    ],
  },
];

export const vinuniScholarships: { base: Scholarship[]; special: Scholarship[]; maintainNote: string } = {
  base: [
    {
      name: 'President’s Excellence Scholarship',
      coverage: '100% tuition + full living stipend',
      type: 'merit',
      eligibility: 'Outstanding academic record, international competition awards, exceptional leadership',
      maintainGPA: 'CGPA ≥ 3.6/4.0',
    },
    {
      name: 'Provost’s Merit Scholarship',
      coverage: '100% tuition',
      type: 'merit',
      eligibility: 'High GPA, strong standardised test scores, demonstrated leadership',
      maintainGPA: 'CGPA ≥ 3.4/4.0',
    },
    {
      name: 'Dean’s Distinction Scholarship',
      coverage: '80%–90% tuition',
      type: 'merit',
      eligibility: 'Excellent academic record + extracurricular impact',
      maintainGPA: 'CGPA ≥ 3.2/4.0',
    },
    {
      name: 'Discipline’s Honor Scholarship',
      coverage: '50%, 60% or 70% tuition',
      type: 'merit',
      eligibility: 'Strong academic profile in target discipline',
      maintainGPA: 'CGPA ≥ 3.0/4.0',
    },
  ],
  special: [
    {
      name: 'Special Academic Scholarship',
      coverage: '5% tuition',
      type: 'special',
      eligibility: 'Stackable with merit awards for top-rated applicants',
    },
    {
      name: 'WIT (Women in Tech) Scholarship',
      coverage: '5% tuition',
      type: 'special',
      eligibility: 'Female applicants to CECS programs',
    },
    {
      name: 'Vinschool–VinUni Transfer Scholarship',
      coverage: 'Tuition discount',
      type: 'transfer',
      eligibility: 'Vinschool graduates transferring to VinUni',
    },
    {
      name: 'DeanChoi Grant by Soosan',
      coverage: '10% tuition',
      type: 'special',
      eligibility: 'Applicants to CBM and CECS programs',
    },
    {
      name: 'FutureLeader Scholarship',
      coverage: '10% tuition',
      type: 'special',
      eligibility: 'Demonstrated leadership in social impact projects',
    },
  ],
  maintainNote:
    'Scholarships are reviewed annually. Students must maintain the stated CGPA + good conduct. Need-based top-ups are available case-by-case.',
};

export const vinuniFinancials = {
  tuitionUsdPerYear: 35000,
  livingCostUsdPerYear: 6000,
  paymentSchedule: 'Tuition paid per semester. Need-based deferrals available on request.',
  onCampusJobs: [
    { role: 'Teaching Assistant (TA)', stipend: 'Hourly stipend + tuition credit', eligibility: 'CGPA ≥ 3.3, recommended by faculty' },
    { role: 'Research Assistant (RA)', stipend: 'Funded research stipend', eligibility: 'Departmental application, faculty match' },
    { role: 'Library & Lab Assistant', stipend: 'Hourly wage', eligibility: 'Open to all enrolled students' },
  ],
};

export const vinuniAdmissions = {
  gpaMin: '8.0/10 (or 3.2/4.0)',
  languageRequirements: [
    { test: 'IELTS Academic', minimum: '6.5 overall, no band below 6.0' },
    { test: 'TOEFL iBT', minimum: '79 overall' },
    { test: 'Duolingo English Test', minimum: '110' },
  ],
  standardizedTests: [
    { test: 'SAT', detail: 'Recommended 1300+ (test-optional in 2025–2026)' },
    { test: 'ACT', detail: 'Recommended composite 28+' },
    { test: 'A-Level / IB / AP', detail: 'Accepted with strong scores in target subjects' },
  ],
  documentsRequired: [
    'High school transcripts (last 3 years)',
    'Personal statement (500–800 words)',
    'Two letters of recommendation (academic + community)',
    'Updated CV / activity list',
    'Portfolio (Arts & Design applicants only)',
    'Proof of English proficiency',
  ],
  deadlines: [
    { round: 'Early Decision', deadline: 'Mid-November', notify: 'Mid-December' },
    { round: 'Regular Decision', deadline: 'Mid-January', notify: 'Mid-March' },
    { round: 'Rolling Admissions', deadline: 'Until seats filled (typically May)', notify: 'Within 4–6 weeks' },
  ],
  scholarshipDeadlineNote:
    'Apply by Early Decision to maximise scholarship consideration. Scholarship decisions are released alongside admission decisions.',
  interview: 'Shortlisted applicants are invited to a virtual interview (Personal & Behavioural).',
};

export const vinuniCareer = {
  employmentRatePercent: 100,
  averageStartingSalaryUsd: 18000,
  partnerCompanies: [
    'VinFast', 'Vinmec', 'VinAI', 'Microsoft Vietnam', 'Google Vietnam',
    'McKinsey & Company', 'Boston Consulting Group', 'Goldman Sachs',
    'Samsung R&D Vietnam', 'NVIDIA', 'Techcombank', 'VPBank',
  ],
  internshipPrograms: [
    'VinGroup Industry Immersion Programme (year 2–3)',
    'Global exchange semester at Cornell or Penn',
    'Vinmec clinical rotation (MD/Nursing)',
    'Industry capstone with sponsoring partner (year 4)',
  ],
  alumniNetworkSummary:
    'Although VinUni’s first cohort graduated in 2024, the alumni network is tightly connected through the Cornell and Penn partnerships, opening pathways to graduate study at Ivy League institutions and roles at top global employers.',
  postGradVisa:
    'Vietnamese graduates can work locally without restriction. International graduates may apply for the Vietnam Skilled Worker visa via sponsoring employers; many alumni also pursue Cornell/Penn graduate programs that lead to US OPT eligibility.',
  testimonial: {
    quote:
      'VinUni gave me access to Cornell faculty, Vinmec hospitals and a McKinsey internship — all in four years. It felt like an Ivy League experience without leaving Vietnam.',
    author: 'Class of 2024 alumna, CECS → MS at Cornell Tech',
  },
};

export const vinuniCampusLife = {
  locationDescription:
    'Vinhomes Ocean Park, Gia Lam — a self-contained green township 15 km east of central Hanoi. The campus sits next to lakes, parks and Vinmec Hospital.',
  climate:
    'Northern Vietnam: hot humid summers (30–38°C), cool winters (12–20°C). Four mild seasons, no snow.',
  housing: {
    onCampusRequiredYear1: true,
    description:
      'On-campus housing in modern dormitories with shared common areas, gym, dining halls and 24/7 study spaces. Mandatory for year 1; optional thereafter.',
    monthlyCostUsd: '180–350 (depending on room type)',
  },
  clubs: [
    'VinUni Investment Club', 'AI & Robotics Club', 'Debate Society',
    'Model UN', 'Photography Studio', 'Climbing & Outdoors',
    'Football & Basketball Leagues', 'Choir & Acapella', 'Entrepreneurship Lab',
    'Mental Health Peer Network', 'Volunteer Network', 'eSports League',
  ],
  internationalStudentPercent: 12,
  gallery: [
    {
      caption: 'Main academic building',
      gradient: 'linear-gradient(135deg, #7B2FBE 0%, #FF3D9A 100%)',
    },
    {
      caption: 'Library & study commons',
      gradient: 'linear-gradient(135deg, #00C2FF 0%, #7B2FBE 100%)',
    },
    {
      caption: 'Maker Studio & robotics lab',
      gradient: 'linear-gradient(135deg, #FF3D9A 0%, #00C2FF 100%)',
    },
    {
      caption: 'Vinmec teaching hospital',
      gradient: 'linear-gradient(135deg, #10b981 0%, #00C2FF 100%)',
    },
    {
      caption: 'Dormitory courtyards',
      gradient: 'linear-gradient(135deg, #FF3D9A 0%, #7B2FBE 100%)',
    },
    {
      caption: 'Ocean Park lakeside walk',
      gradient: 'linear-gradient(135deg, #00C2FF 0%, #10b981 100%)',
    },
  ],
};

export const vinuniFaq = [
  {
    question: 'Is VinUni recognised internationally?',
    answer:
      'Yes. VinUni’s programs are co-developed with Cornell University and the University of Pennsylvania, and the degrees are recognised by major global employers and graduate schools.',
  },
  {
    question: 'Can I study abroad during my degree?',
    answer:
      'Top-performing students can apply for an exchange semester at Cornell or Penn, plus summer schools across the partner network.',
  },
  {
    question: 'Is the curriculum taught in English?',
    answer: 'Yes — 100% English-taught across all programs.',
  },
  {
    question: 'What if I cannot afford the tuition?',
    answer:
      'Apply early for merit scholarships. Additional need-based aid is reviewed case-by-case and can stack with merit awards.',
  },
];

export const VINUNI_UNIVERSITY_ID = 97;

// ──────────────────────────────────────────────────────────────────
//  AACC — VinUniversity's holistic admission rubric
//  (Ability · Aspirations · Creativity · Commitment)
// ──────────────────────────────────────────────────────────────────

export type AaccPillarKey = 'ability' | 'aspirations' | 'creativity' | 'commitment';

export type AaccPillar = {
  key: AaccPillarKey;
  name: string;
  nameVi: string;
  accent: 'pink' | 'cyan' | 'purple' | 'emerald';
  description: string;
  indicators: string[];
};

export const VINUNI_AACC_PILLARS: readonly AaccPillar[] = [
  {
    key: 'ability',
    name: 'Outstanding Ability',
    nameVi: 'Năng lực Vượt trội',
    accent: 'pink',
    description:
      'Exceptional capabilities in academics or other skills that strongly predict future success.',
    indicators: [
      'High GPA, SAT/AP scores or National Exam marks',
      'National or international competition results',
      'Sharp analytical, problem-solving and English skills',
      'Excellence in sports, arts or technical areas',
    ],
  },
  {
    key: 'aspirations',
    name: 'Aspirations',
    nameVi: 'Khát vọng',
    accent: 'purple',
    description:
      'A deep understanding of societal challenges and a powerful drive to solve them.',
    indicators: [
      'Ambitious but realistic goals that push boundaries',
      'Desire to lift others out of poverty or disadvantage',
      'Stepping up to volunteer, lead and inspire others',
      'Meaningful, purpose-driven hobbies',
    ],
  },
  {
    key: 'creativity',
    name: 'Creativity',
    nameVi: 'Sáng tạo',
    accent: 'cyan',
    description:
      'A unique mindset characterised by high curiosity, adaptability and openness to novel solutions.',
    indicators: [
      'Critical, divergent thinking ("outside the box")',
      'Digging for root causes rather than waiting for answers',
      'Healthy norm-breaking for positive change',
      'Sharp, logical debating and articulation',
    ],
  },
  {
    key: 'commitment',
    name: 'Commitment',
    nameVi: 'Cam kết',
    accent: 'emerald',
    description:
      'Unwavering belief in one’s potential, backed by mental and physical grit to achieve goals.',
    indicators: [
      'Resilience when tasks get tough',
      'Perseverance — staying loyal to promises and projects',
      'Determination — pouring 100% effort into top outcomes',
      'Long-term track record on hard goals',
    ],
  },
] as const;

export const vinuniSopGuidance = {
  intro:
    'VinUni reads every Statement of Purpose through the AACC lens. The strongest essays do not name the four pillars explicitly — they prove each one with specific, lived evidence. Aim for 600–900 words.',
  structure: [
    'Opening hook — a moment, scene or question that frames who you are',
    'Defining story — the experience that sharpened your direction',
    'Pillar evidence — concrete examples mapped to Ability, Aspirations, Creativity, Commitment',
    'Why VinUni — the specific programs, faculty, labs or partnerships that fit your trajectory',
    'Forward vision — what you will build, and the impact you intend',
  ],
  lengthGuide: '600–900 words. Specificity and verifiable evidence beat polished generalities.',
  pillarTips: {
    ability: {
      prompts: [
        'Which result of yours is hardest to fake? (rank, score, prize, published work)',
        'Where did you out-perform expectations — and what did it cost you?',
      ],
      examples: [
        'Top-3 national informatics olympiad, Silver IMO, 1580 SAT, IELTS 8.5, AP Calc BC 5.',
        'Solo-led a 4-week project that shipped an app used by 1,200 classmates.',
      ],
      pitfalls: [
        'Listing scores without context — pair each result with the obstacle it overcame.',
        'Claiming "I am a hard worker" instead of showing the evidence trail.',
      ],
    },
    aspirations: {
      prompts: [
        'Which problem hurts you to watch — and what would you do about it given resources?',
        'Whose life do you want to change in 10 years, and how?',
      ],
      examples: [
        'After teaching English in my mother’s home village, I want to build low-cost adaptive learning for under-resourced provinces.',
      ],
      pitfalls: [
        '"I want to be successful" is not an aspiration. Name the people, the problem, the impact.',
        'Avoid copy-pasted slogans. Aspirations must feel rooted in your own story.',
      ],
    },
    creativity: {
      prompts: [
        'When did you reject the obvious answer and find a better one?',
        'What constraint forced you to invent your own method?',
      ],
      examples: [
        'Re-designed our debate club’s judging rubric after noticing systematic bias against quiet speakers — adoption rate hit 100% the next semester.',
      ],
      pitfalls: [
        '"I love thinking creatively" is filler. Show a moment of original synthesis.',
        'Beware of confusing "weird" with "creative" — original means useful, not random.',
      ],
    },
    commitment: {
      prompts: [
        'What did you keep doing after it stopped being fun?',
        'What setback shook you, and how did you come back from it?',
      ],
      examples: [
        'Failed my first national exam in year 10. Built a 18-month study plan, kept it for 78 weeks, scored top decile in year 12.',
      ],
      pitfalls: [
        'Listing many activities for a few months each signals breadth, not commitment — pick 1–2 with multi-year arcs.',
        'Avoid generic phrases like "I never give up". Show the data: weeks, hours, outcomes.',
      ],
    },
  },
} as const;

