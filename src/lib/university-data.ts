export interface UniversityReview {
  name: string;
  stars: number; // 1–5
  text: string;
}

export interface University {
  id: number;
  name: string;
  location: string;
  emoji: string;
  color: string; // hex, used as banner background tint
  rating: number; // e.g. 4.9
  reviews: number; // total review count
  acceptance: string; // e.g. "17%"
  tags: string[]; // e.g. ["Russell Group", "Global Top 50"]
  rank: string; // e.g. "#1 UK"
  founded: string; // e.g. "1096"
  description: string;
  stats: {
    students: string;
    staff: string;
    campuses: string;
  };
  requirements: string[];
  reviewsData: UniversityReview[];
}

export interface ApplicationStage {
  label: string;
  icon: string; // emoji
  description: string;
}

export const APPLICATION_STAGES: ApplicationStage[] = [
  { label: 'Submitted', icon: '📨', description: 'Application submitted to UCAS' },
  { label: 'Preparing Documents', icon: '📋', description: 'University reviewing your documents' },
  { label: 'Entry Assessment', icon: '📝', description: 'Admissions test or written assessment' },
  { label: 'Interview Stage', icon: '🎤', description: 'Interview invitation — prepare thoroughly' },
  { label: 'Awaiting Decision', icon: '⏳', description: 'Decision being finalised by admissions' },
  { label: 'Offer Received', icon: '🎉', description: 'Congratulations — offer in hand!' },
];

export const FILTER_CATEGORIES = ['All', 'Russell Group', 'STEM', 'Arts & Humanities', 'Global Top 50'] as const;
export type FilterCategory = (typeof FILTER_CATEGORIES)[number];

export const UNIVERSITIES: University[] = [
  {
    id: 1,
    name: 'University of Oxford',
    location: 'Oxford, UK',
    emoji: '🏛️',
    color: '#1a3a6c',
    rating: 4.9,
    reviews: 8241,
    acceptance: '17%',
    tags: ['Russell Group', 'Global Top 50'],
    rank: '#1 UK',
    founded: '1096',
    description:
      'The oldest university in the English-speaking world, Oxford has educated 28 British Prime Ministers and countless global leaders. A place where tradition and world-class research collide in the most dramatic fashion possible.',
    stats: { students: '24,000', staff: '14,000', campuses: '44 Colleges' },
    requirements: [
      'A-levels: A*A*A minimum',
      'Oxford Admissions Test (subject-specific)',
      'Interview (most courses)',
      'Personal Statement',
      'Academic Reference',
    ],
    reviewsData: [
      {
        name: 'Sarah M.',
        stars: 5,
        text: 'Tutorial system is unmatched. You are held to an exceptionally high standard and the intellectual environment is transformative.',
      },
      {
        name: 'James L.',
        stars: 4,
        text: 'Incredibly demanding but incredibly rewarding. The collegiate system makes a huge university feel intimate.',
      },
    ],
  },
  {
    id: 2,
    name: 'University of Cambridge',
    location: 'Cambridge, UK',
    emoji: '🎓',
    color: '#4a0a0a',
    rating: 4.9,
    reviews: 7880,
    acceptance: '19%',
    tags: ['Russell Group', 'Global Top 50'],
    rank: '#2 UK',
    founded: '1209',
    description:
      "Home to Newton, Darwin, Hawking and 121 Nobel laureates — Cambridge's collegiate system and supervision model produces some of the world's most rigorous thinkers. Where excellence is the baseline, not the ambition.",
    stats: { students: '23,000', staff: '13,500', campuses: '31 Colleges' },
    requirements: [
      'A-levels: A*A*A typical',
      'Pre-Interview Assessments',
      'Interview mandatory',
      'Personal Statement',
      'School Reference',
    ],
    reviewsData: [
      {
        name: 'Priya K.',
        stars: 5,
        text: 'The supervision system is intense but you come out as a completely different kind of thinker. Worth every sleepless night.',
      },
      {
        name: 'Tom R.',
        stars: 4,
        text: 'The workload is genuinely immense. But the people, the libraries, the atmosphere — nothing compares.',
      },
    ],
  },
  {
    id: 3,
    name: 'Imperial College London',
    location: 'London, UK',
    emoji: '⚗️',
    color: '#003d7c',
    rating: 4.8,
    reviews: 5120,
    acceptance: '14%',
    tags: ['Russell Group', 'STEM', 'Global Top 50'],
    rank: '#3 UK',
    founded: '1907',
    description:
      "The world's pre-eminent STEM institution, Imperial sits at the cutting edge of science, engineering, medicine and business. Alumni have founded 5,200 companies and generated £120bn in business value.",
    stats: { students: '19,000', staff: '8,000', campuses: 'South Kensington' },
    requirements: [
      'A-levels: A*AA (STEM subjects)',
      'Mathematics essential',
      'Personal Statement',
      'Academic Reference',
      'Some courses require entrance exam',
    ],
    reviewsData: [
      {
        name: 'Wei C.',
        stars: 5,
        text: 'If you want pure STEM excellence, there is nowhere better. The research facilities are extraordinary.',
      },
      {
        name: 'Aisha B.',
        stars: 4,
        text: 'Extremely demanding. London location is a double-edged sword. But the career outcomes speak for themselves.',
      },
    ],
  },
  {
    id: 4,
    name: 'University of Birmingham',
    location: 'Birmingham, UK',
    emoji: '🔵',
    color: '#003087',
    rating: 4.5,
    reviews: 3201,
    acceptance: '68%',
    tags: ['Russell Group', 'STEM'],
    rank: '#14 UK',
    founded: '1900',
    description:
      "A founding member of the Russell Group with a stunning redbrick campus, Birmingham combines research excellence with genuine student satisfaction. Home to a pioneering computer science department with strong industry links across the Midlands tech corridor.",
    stats: { students: '36,000', staff: '8,200', campuses: 'Edgbaston' },
    requirements: [
      'A-levels: ABB-AAA (course dependent)',
      'Personal Statement',
      'Academic Reference',
      'Interview (some courses)',
    ],
    reviewsData: [
      {
        name: 'Aurelian V.',
        stars: 5,
        text: "The CS department has excellent industry connections. Birmingham's tech scene is underrated and growing fast.",
      },
      {
        name: 'Emma S.',
        stars: 4,
        text: 'Beautiful campus, strong department, great city. The cost of living vs London is honestly a huge bonus.',
      },
    ],
  },
  {
    id: 5,
    name: 'University of Edinburgh',
    location: 'Edinburgh, UK',
    emoji: '🏰',
    color: '#5c0000',
    rating: 4.7,
    reviews: 4350,
    acceptance: '42%',
    tags: ['Russell Group', 'Global Top 50', 'Arts'],
    rank: '#15 UK',
    founded: '1583',
    description:
      "Set in one of Europe's most beautiful cities, Edinburgh blends centuries of tradition with a fiercely international outlook. Among the oldest universities in the English-speaking world, with exceptional arts, humanities, and informatics.",
    stats: { students: '41,000', staff: '11,000', campuses: 'City of Edinburgh' },
    requirements: [
      'A-levels: AAA-ABB',
      'Personal Statement',
      'Academic Reference',
      'Some courses: portfolio or audition',
    ],
    reviewsData: [
      {
        name: 'Niamh O.',
        stars: 5,
        text: 'The city IS the campus. Studying here is a lifestyle. The international community is vibrant and welcoming.',
      },
      {
        name: 'Luca M.',
        stars: 5,
        text: 'Informatics is world-class. The Old Town atmosphere makes working late in the library feel almost romantic.',
      },
    ],
  },
  {
    id: 6,
    name: 'University of Manchester',
    location: 'Manchester, UK',
    emoji: '🐝',
    color: '#a6093d',
    rating: 4.6,
    reviews: 5890,
    acceptance: '55%',
    tags: ['Russell Group', 'STEM', 'Arts'],
    rank: '#8 UK',
    founded: '1824',
    description:
      "Manchester has produced 25 Nobel laureates, more than almost anywhere. Its civic identity is fierce and its research output prodigious. The city is one of the UK's most vibrant, and students here are famously satisfied.",
    stats: { students: '44,000', staff: '12,000', campuses: 'Oxford Road' },
    requirements: [
      'A-levels: ABB-AAA',
      'Personal Statement',
      'Academic Reference',
    ],
    reviewsData: [
      {
        name: 'Dev P.',
        stars: 5,
        text: 'The student union is the biggest in Europe and it shows. Academic quality is high but the social scene is extraordinary.',
      },
      {
        name: 'Rosa T.',
        stars: 4,
        text: 'Great course, great city, great people. Rain is real but honestly you stop noticing.',
      },
    ],
  },
  {
    id: 7,
    name: 'London School of Economics',
    location: 'London, UK',
    emoji: '📊',
    color: '#1b2a4a',
    rating: 4.7,
    reviews: 3940,
    acceptance: '11%',
    tags: ['Russell Group', 'Global Top 50', 'Arts'],
    rank: '#5 UK (Social Sci)',
    founded: '1895',
    description:
      "The global hub for economics, political science, law and social sciences. 18 heads of state, 37 Nobel laureates, and some of the most influential thinkers in policy and finance trace roots to LSE's Houghton Street campus.",
    stats: { students: '12,000', staff: '3,500', campuses: 'Central London' },
    requirements: [
      'A-levels: A*AA typical',
      'Strong Maths for Economics',
      'Personal Statement',
      'Academic Reference',
    ],
    reviewsData: [
      {
        name: 'Fatima A.',
        stars: 5,
        text: 'The debate culture, the visiting speakers, the alumni network — LSE operates in a different stratosphere for social sciences.',
      },
      {
        name: 'Hugo V.',
        stars: 4,
        text: 'Small campus, huge prestige. London location means internships are basically part of the curriculum.',
      },
    ],
  },
  {
    id: 8,
    name: 'University of Bath',
    location: 'Bath, UK',
    emoji: '🌿',
    color: '#004b87',
    rating: 4.6,
    reviews: 2810,
    acceptance: '60%',
    tags: ['STEM'],
    rank: '#6 UK (Teaching)',
    founded: '1966',
    description:
      "Consistently top-ranked for student experience and graduate employment, Bath's placement year programme is among the UK's best. Exceptional engineering, management and pharmacy departments set against one of England's most beautiful cities.",
    stats: { students: '22,000', staff: '4,500', campuses: 'Claverton Down' },
    requirements: [
      'A-levels: AAA-ABB',
      'Personal Statement',
      'Academic Reference',
      'Work placement interview (industry year)',
    ],
    reviewsData: [
      {
        name: 'Callum F.',
        stars: 5,
        text: "Placement year changed my career entirely. Bath's industry connections are phenomenal, especially for engineering and management.",
      },
      {
        name: 'Zara K.',
        stars: 5,
        text: 'The campus is gorgeous and the city is even better. Academic standards are high but the support is excellent.',
      },
    ],
  },
  {
    id: 9,
    name: "King's College London",
    location: 'London, UK',
    emoji: '👑',
    color: '#890000',
    rating: 4.5,
    reviews: 4120,
    acceptance: '37%',
    tags: ['Russell Group', 'Global Top 50', 'Arts'],
    rank: '#7 UK',
    founded: '1829',
    description:
      "One of the world's oldest universities, KCL sits on the Thames in the heart of London. Exceptional for medicine, law, humanities and social sciences, with a heritage that runs from Florence Nightingale to Archbishop Desmond Tutu.",
    stats: { students: '33,000', staff: '8,500', campuses: '4 London Campuses' },
    requirements: [
      'A-levels: AAA-ABB (course dependent)',
      'UCAT/BMAT for Medicine',
      'Personal Statement',
      'Academic Reference',
    ],
    reviewsData: [
      {
        name: 'Isabelle R.',
        stars: 5,
        text: 'Law at KCL is outstanding. The location on the Strand is unbeatable for networking and internship opportunities.',
      },
      {
        name: 'Omar S.',
        stars: 4,
        text: 'Great facilities, strong research culture. The Strand campus view of the Thames never gets old.',
      },
    ],
  },
  {
    id: 10,
    name: 'University of Leeds',
    location: 'Leeds, UK',
    emoji: '🦁',
    color: '#003da5',
    rating: 4.5,
    reviews: 3780,
    acceptance: '72%',
    tags: ['Russell Group', 'Arts'],
    rank: '#11 UK',
    founded: '1904',
    description:
      "A true powerhouse of the North, Leeds combines Russell Group academic rigour with one of the UK's best student cities. Known for creative industries, business, and the life sciences — and a student union that never sleeps.",
    stats: { students: '38,000', staff: '9,000', campuses: 'Woodhouse Moor' },
    requirements: [
      'A-levels: ABB-AAA',
      'Personal Statement',
      'Academic Reference',
    ],
    reviewsData: [
      {
        name: 'Megan D.',
        stars: 5,
        text: 'Best student city in the UK, hands down. The creative arts programmes are genuinely world-class.',
      },
      {
        name: 'Aaron W.',
        stars: 4,
        text: 'Great city, great value, genuinely excellent teaching in business and creative fields.',
      },
    ],
  },
  {
    id: 11,
    name: 'Royal College of Art',
    location: 'London, UK',
    emoji: '🎨',
    color: '#2d2d2d',
    rating: 4.8,
    reviews: 1240,
    acceptance: '21%',
    tags: ['Arts', 'Global Top 50'],
    rank: '#1 Art & Design Globally',
    founded: '1837',
    description:
      'The world\'s top-ranked art and design university for eight consecutive years. A postgraduate-only institution where Jony Ive, David Hockney and Barbara Hepworth found their creative language. Entry is by portfolio and passion.',
    stats: { students: '2,400', staff: '900', campuses: 'South Kensington & Battersea' },
    requirements: [
      'Portfolio (primary requirement)',
      'Artist Statement',
      'Interview',
      "Bachelor's degree or equivalent",
      'References',
    ],
    reviewsData: [
      {
        name: 'Celeste M.',
        stars: 5,
        text: 'The peer group alone is worth the tuition. Every person here is pushing the boundaries of their discipline.',
      },
      {
        name: 'Hiro T.',
        stars: 5,
        text: 'Portfolio-led culture means your work does the talking. The critique culture is rigorous and transformative.',
      },
    ],
  },
  {
    id: 12,
    name: 'University of Warwick',
    location: 'Coventry, UK',
    emoji: '⚔️',
    color: '#4a0a77',
    rating: 4.6,
    reviews: 3540,
    acceptance: '50%',
    tags: ['Russell Group', 'STEM', 'Global Top 50'],
    rank: '#9 UK',
    founded: '1965',
    description:
      'A young institution with truly remarkable ambition. Warwick has punched far above its age in research output and is particularly distinguished for mathematics, computer science, economics and theatre studies.',
    stats: { students: '29,000', staff: '7,000', campuses: 'Coventry/Warwickshire border' },
    requirements: [
      'A-levels: AAA-ABB',
      'Personal Statement',
      'Academic Reference',
      'Some courses: entrance assessment',
    ],
    reviewsData: [
      {
        name: 'Yuki N.',
        stars: 5,
        text: 'Maths and CS are extraordinarily good. The campus is self-contained which some love and some find isolating — know yourself.',
      },
      {
        name: 'Beth H.',
        stars: 4,
        text: 'Strong research culture even for undergrads. The arts centre on campus is a genuinely wonderful bonus.',
      },
    ],
  },
];
