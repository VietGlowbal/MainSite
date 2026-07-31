/**
 * THROWAWAY DEMO — fixture data. Delete with the folder.
 *
 * Typed with the real domain types from `@/features/application-strategy/domain`
 * so the demo cannot drift from the committed shapes. If a fixture stops
 * compiling, the domain type changed and the demo is telling you so.
 *
 * Content is illustrative but plausible: a Vietnamese undergraduate applying to
 * a UK computer science course, matching the GEO content already in the repo.
 */

import type {
  AaccAssessment,
  CvLayoutKey,
  CvReview,
  CvSection,
  CvSectionKind,
  CvTargetProfile,
  StatementAnalysis,
  StatementBrief,
  StatementFinding,
  StructuredCv,
  TargetProfileField,
} from '@/features/application-strategy/domain';

// ── Scenarios ─────────────────────────────────────────────────────────────

export const SCENARIOS = ['empty', 'partial', 'ready'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABEL: Record<Scenario, string> = {
  empty: 'Nothing started',
  partial: 'In progress, review stale',
  ready: 'Ready for audit',
};

export function parseScenario(value: string | undefined): Scenario {
  return SCENARIOS.includes(value as Scenario) ? (value as Scenario) : 'partial';
}

/** The demo's stand-in application id. Only ever used in URLs and labels. */
export const DEMO_APPLICATION_ID = 'demo-app-0001';

// ── Application context ───────────────────────────────────────────────────

export const DEMO_APPLICATION = {
  universityName: 'University of Manchester',
  courseName: 'BSc Computer Science',
  degreeLevel: 'Undergraduate',
  deadline: '2027-01-15',
  applicationStatus: 'In progress',
};

// ── Target profile ────────────────────────────────────────────────────────

export const TARGET_PROFILE_LABELS: Record<
  TargetProfileField,
  { vi: string; en: string; origin: 'university' | 'profile' | 'mixed' }
> = {
  careerDirection: {
    vi: 'Định hướng nghề nghiệp',
    en: 'Career direction',
    origin: 'profile',
  },
  universityPositioning: {
    vi: 'Định vị của trường',
    en: 'University positioning',
    origin: 'university',
  },
  educationPhilosophy: {
    vi: 'Triết lý giáo dục',
    en: 'Education philosophy',
    origin: 'university',
  },
  environment: {
    vi: 'Môi trường học tập',
    en: 'Learning environment',
    origin: 'university',
  },
  programmeObjectives: {
    vi: 'Mục tiêu chương trình',
    en: 'Programme objectives',
    origin: 'university',
  },
  priorityCapabilities: {
    vi: 'Năng lực ưu tiên',
    en: 'Priority capabilities',
    origin: 'mixed',
  },
  careerAlignment: {
    vi: 'Sự phù hợp nghề nghiệp',
    en: 'Career alignment',
    origin: 'mixed',
  },
};

/** Quiet placeholder text for the ungenerated state. Never saved student data. */
export const TARGET_PROFILE_EXAMPLES: Record<TargetProfileField, string> = {
  careerDirection: 'e.g. Backend engineering, then applied machine learning',
  universityPositioning: 'e.g. Research-led, strong industry placement record',
  educationPhilosophy: 'e.g. Independent study supported by small-group tutorials',
  environment: 'e.g. Large cohort, project-based assessment, active societies',
  programmeObjectives: 'e.g. Graduates who can specify and build production systems',
  priorityCapabilities: 'e.g. Algorithmic reasoning, evidence of shipped software',
  careerAlignment: 'e.g. Placement year feeding a graduate engineering role',
};

const GENERATED_TARGET_PROFILE: Record<TargetProfileField, string> = {
  careerDirection:
    'Software engineering with a route into applied machine learning, starting from backend work.',
  universityPositioning:
    'Research-led department, Russell Group, with an established industrial placement year.',
  educationPhilosophy:
    'Independent study carried by lectures and small-group tutorials; students are expected to read beyond the set material.',
  environment:
    'Large cohort with substantial coursework and group projects; active student societies including a competitive programming club.',
  programmeObjectives:
    'Graduates who can reason about algorithms formally and build software that runs in production.',
  priorityCapabilities:
    'Demonstrated algorithmic reasoning, evidence of software actually shipped and used, and the ability to work in a team over a sustained project.',
  careerAlignment:
    'The placement year is the mechanism the department expects students to convert into a graduate engineering offer.',
};

export function makeTargetProfile(scenario: Scenario): CvTargetProfile | null {
  if (scenario === 'empty') return null;

  return {
    id: 'tp-1',
    strategyId: 'strategy-1',
    ...GENERATED_TARGET_PROFILE,
    missingInformation:
      scenario === 'ready'
        ? []
        : [
            'No evidence yet of a sustained team project longer than one term.',
            'Preferred specialisation within machine learning is not stated in your profile.',
          ],
    sourcesUsed: [
      {
        field: 'programmeObjectives',
        url: 'https://www.manchester.ac.uk/study/undergraduate/courses/computer-science',
        heading: 'Programme aims',
        snippet: 'develop the ability to design, implement and evaluate computing systems',
      },
      {
        field: 'universityPositioning',
        url: 'https://www.manchester.ac.uk/study/undergraduate/placements',
        heading: 'Industrial experience',
        snippet: 'an optional paid placement year between the second and final year',
      },
    ],
    // `partial` has been edited since generation, which is what makes the
    // stored review stale further down.
    version: scenario === 'ready' ? 2 : 3,
    generatedAt: '2026-07-24T09:12:00.000Z',
    updatedAt: '2026-07-28T14:03:00.000Z',
  };
}

// ── CV sections ───────────────────────────────────────────────────────────

export const SECTION_LABELS: Record<CvSectionKind, string> = {
  contact: 'Contact',
  education: 'Education',
  experience: 'Experience',
  activities: 'Activities',
  projects: 'Projects',
  research: 'Research',
  awards: 'Awards',
  skills: 'Skills',
  certifications: 'Certifications',
  publications: 'Publications',
  interests: 'Interests',
  custom: 'Custom section',
};

/** Which fields the entry editor shows, per section kind. */
export const SECTION_FIELDS: Record<CvSectionKind, Array<keyof CvEntryFieldSet>> = {
  contact: ['organization'],
  education: ['organization', 'role', 'location', 'startDate', 'endDate'],
  experience: ['organization', 'role', 'location', 'startDate', 'endDate'],
  activities: ['organization', 'role', 'startDate', 'endDate'],
  projects: ['role', 'startDate', 'endDate'],
  research: ['organization', 'role', 'startDate', 'endDate'],
  awards: ['organization', 'startDate'],
  skills: [],
  certifications: ['organization', 'startDate'],
  publications: ['organization', 'startDate'],
  interests: [],
  custom: ['organization', 'role', 'startDate', 'endDate'],
};

type CvEntryFieldSet = {
  organization: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
};

export const OPTIONAL_SECTIONS: CvSectionKind[] = [
  'activities',
  'research',
  'awards',
  'certifications',
  'publications',
  'interests',
  'custom',
];

const DEMO_SECTIONS: CvSection[] = [
  {
    id: 's-contact',
    kind: 'contact',
    entries: [
      {
        id: 'e-contact',
        organization: 'Nguyễn Minh Anh — Hanoi, Vietnam — minhanh@example.com',
        bullets: [],
        collapsed: true,
      },
    ],
  },
  {
    id: 's-education',
    kind: 'education',
    entries: [
      {
        id: 'e-edu-1',
        organization: 'Hanoi–Amsterdam High School for the Gifted',
        role: 'Specialised Mathematics stream',
        location: 'Hanoi, Vietnam',
        startDate: '2023',
        endDate: '2026',
        bullets: [
          'GPA 9.2/10 across three years, ranked in the top 5% of the mathematics stream.',
          'IELTS 7.5 overall, writing 7.0.',
        ],
        evidence: 'Transcript and IELTS certificate uploaded to Glowbal profile',
        collapsed: false,
      },
    ],
  },
  {
    id: 's-projects',
    kind: 'projects',
    entries: [
      {
        id: 'e-proj-1',
        role: 'Bus arrival predictor for Hanoi route 32',
        startDate: '2025',
        endDate: '2026',
        bullets: [
          'Built a Python service predicting arrival times from scraped timetable and GPS data.',
          'Used by roughly 400 students at my school in the first term.',
        ],
        evidence: 'GitHub repository, 41 stars',
        collapsed: true,
      },
      {
        id: 'e-proj-2',
        role: 'Vietnamese handwriting recognition model',
        startDate: '2025',
        bullets: [
          'Trained a small CNN on a self-labelled dataset of 6,000 handwriting samples.',
          'Reached 91% character accuracy on a held-out test set.',
        ],
        collapsed: true,
      },
    ],
  },
  {
    id: 's-activities',
    kind: 'activities',
    entries: [
      {
        id: 'e-act-1',
        organization: 'School Informatics Club',
        role: 'Vice president',
        startDate: '2024',
        endDate: '2026',
        bullets: [
          'Ran weekly competitive programming sessions for about 25 members.',
          'Organised an inter-school contest with four participating schools.',
        ],
        collapsed: true,
      },
    ],
  },
  {
    id: 's-awards',
    kind: 'awards',
    entries: [
      {
        id: 'e-award-1',
        organization: 'Hanoi City Informatics Olympiad',
        startDate: '2025',
        bullets: ['Second prize, individual round.'],
        collapsed: true,
      },
    ],
  },
  {
    id: 's-skills',
    kind: 'skills',
    entries: [
      {
        id: 'e-skills',
        bullets: [
          'Python, TypeScript, C++',
          'PostgreSQL, Git, Linux',
          'Vietnamese (native), English (IELTS 7.5)',
        ],
        collapsed: false,
      },
    ],
  },
];

export function makeStructuredCv(scenario: Scenario): StructuredCv | null {
  if (scenario === 'empty') return null;

  const ready = scenario === 'ready';

  return {
    id: 'cv-1',
    strategyId: 'strategy-1',
    sourceDocumentId: 'doc-1',
    sections: DEMO_SECTIONS,
    selectedLayout: ready ? 'technical' : null,
    // `partial` sits at content version 7 while the stored review read 5, so
    // isReviewOutdated returns true without the demo hardcoding "stale".
    contentVersion: ready ? 5 : 7,
    lastReviewedVersion: 5,
    lastExportedVersion: ready ? 5 : 6,
    updatedAt: '2026-07-29T11:20:00.000Z',
  };
}

// ── CV review ─────────────────────────────────────────────────────────────

export function makeCvReview(scenario: Scenario): CvReview | null {
  if (scenario === 'empty') return null;

  return {
    id: 'review-1',
    cvId: 'cv-1',
    targetProfileVersion: 2,
    contentVersion: 5,
    strengths: [
      {
        title: 'Software that other people actually used',
        evidence:
          'Used by roughly 400 students at my school in the first term.',
        targetProfileArea: 'Priority capabilities — evidence of software actually shipped',
        programmeRelevance:
          'The department states it wants graduates who can build systems that run in production, not only coursework.',
        strength: 'strong',
      },
      {
        title: 'Algorithmic reasoning backed by a placed result',
        evidence: 'Second prize, individual round. Hanoi City Informatics Olympiad, 2025.',
        targetProfileArea: 'Priority capabilities — demonstrated algorithmic reasoning',
        programmeRelevance:
          'A placed olympiad result is the most direct external check on the formal reasoning the first year assumes.',
        strength: 'strong',
      },
      {
        title: 'Machine learning worked on rather than described',
        evidence:
          'Trained a small CNN on a self-labelled dataset of 6,000 handwriting samples.',
        targetProfileArea: 'Career direction — route into applied machine learning',
        programmeRelevance:
          'Self-labelling the dataset shows the unglamorous part of ML work, which reads as genuine interest.',
        strength: 'moderate',
      },
    ],
    missingSignals: [
      {
        signal: 'No sustained team project',
        reason:
          'The programme expects work in a team over a sustained project, and every entry here is either solo or a club role rather than a shared build.',
        action:
          'Add the inter-school contest as a project entry naming who you worked with and what you personally owned.',
        targetSection: 'projects',
        critical: scenario !== 'ready',
      },
      {
        signal: 'The placement year is never acknowledged',
        reason:
          'Your target profile identifies the placement year as the route to a graduate offer, but nothing in the CV shows interest in industry experience.',
        action:
          'If you have done any paid or unpaid technical work, add it under Experience, however small.',
        targetSection: 'experience',
        critical: false,
      },
      {
        signal: 'Leadership is stated but not sized',
        reason:
          'Vice president of the Informatics Club is a title. The reader cannot tell what changed while you held it.',
        action:
          'Add one measurable outcome to the club entry, for example membership growth or contest placements.',
        targetSection: 'activities',
        critical: false,
      },
    ],
    summary:
      'A technically credible CV for this course. The evidence of shipped software and the olympiad result together cover the two capabilities the department prioritises. The clearest gap is collaborative work: nothing here shows you sustaining a project with other people, which the programme explicitly expects.',
    sourcesUsed: [],
    model: 'demo-fixture',
    createdAt: '2026-07-26T16:40:00.000Z',
  };
}

// ── Layouts ───────────────────────────────────────────────────────────────

export type DemoLayout = {
  key: CvLayoutKey;
  label: string;
  summary: string;
  /** Structurally different section order — the point of the three layouts. */
  order: CvSectionKind[];
  emphasise: CvSectionKind[];
  columns: 1 | 2;
};

export const DEMO_LAYOUTS: DemoLayout[] = [
  {
    key: 'academic',
    label: 'Academic',
    summary: 'Leads with education and research. Single column, conservative.',
    order: ['contact', 'education', 'research', 'publications', 'projects', 'awards', 'skills'],
    emphasise: ['education', 'research', 'publications'],
    columns: 1,
  },
  {
    key: 'technical',
    label: 'Technical',
    summary: 'Leads with skills and projects, with measurable outcomes pulled up.',
    order: ['contact', 'skills', 'projects', 'experience', 'education', 'awards', 'activities'],
    emphasise: ['skills', 'projects'],
    columns: 2,
  },
  {
    key: 'leadership',
    label: 'Leadership',
    summary: 'Leads with roles and organisations, then community impact.',
    order: ['contact', 'activities', 'experience', 'awards', 'projects', 'education', 'skills'],
    emphasise: ['activities', 'experience'],
    columns: 1,
  },
];

/**
 * Deterministic recommendation, derived from where the CV's evidence sits.
 * Mirrors the shape `recommendLayout` will have; the reason names real target
 * profile content rather than being generic praise.
 */
export function recommendLayout(): { key: CvLayoutKey; reason: string } {
  return {
    key: 'technical',
    reason:
      'Your target profile puts shipped software and algorithmic reasoning first, and both live in your Projects and Skills sections — so the technical layout leads with your strongest evidence.',
  };
}

// ── Statement ─────────────────────────────────────────────────────────────

export const DEMO_STATEMENT_PROMPT =
  'Why do you want to study computer science, and what have you done that shows it?';

export const DEMO_WORD_LIMIT = 650;

export const DEMO_STATEMENT_BRIEF: StatementBrief = {
  mustDemonstrate: [
    'A specific reason for computer science rather than a general interest in technology.',
    'Evidence you can sustain difficult work without being set it.',
    'Awareness of what this particular department teaches.',
  ],
  programmeInformation: [
    'The first year assumes formal algorithmic reasoning from the start.',
    'An optional paid placement year sits between the second and final year.',
    'Assessment is weighted towards coursework and group projects.',
  ],
  evidenceToConsider: [
    'The bus predictor used by about 400 students — the strongest "I shipped something" fact you have.',
    'Self-labelling 6,000 handwriting samples, which shows tolerance for tedious work.',
    'Second prize at the Hanoi City Informatics Olympiad.',
  ],
  coveredByCv: [
    'The olympiad result and your GPA are already in the CV. Do not spend words restating them.',
    'Your club role is listed. The statement should add why it mattered, not repeat the title.',
  ],
  missingInformation: [
    'Nothing in your profile explains what first pulled you towards computing.',
    'No stated view on which area of machine learning interests you.',
  ],
};

export const DEMO_STATEMENT_DRAFT = `The bus was late again. Route 32 into central Hanoi ran to a timetable that everyone had quietly agreed to ignore, and I had spent most of that year standing at the stop guessing. What changed was not the bus. It was noticing that the guessing was a data problem, and that I could do something about it.

I started scraping the published timetable and pairing it with GPS pings from the operator's own tracking page. The first version was wrong most of the time. The second was wrong in a more interesting way: it was accurate at rush hour and useless at midday, which turned out to be a sampling problem rather than a modelling one. By the third version I had something that was right within four minutes, and I put it behind a small web page so my classmates could use it. About four hundred of them did over that first term. Some of them told me when it was wrong, which was more useful than the stars it collected on GitHub.

That project is why I want to study computer science rather than a subject that merely uses computers. The interesting part was not writing the code. It was working out which part of the problem was actually the problem.

I have followed the same instinct into machine learning. I wanted to build a handwriting recogniser for Vietnamese, and quickly found there was no dataset with the diacritics handled properly, so I labelled six thousand samples myself. It took weeks and most of it was tedious. The model reached ninety-one per cent character accuracy, which I know is unremarkable, but the labelling taught me more than the architecture did: that most of the difficulty in applied machine learning sits in the data, not the model.

Competitive programming has been the counterweight. Running the weekly sessions at my school's Informatics Club forced me to explain solutions rather than merely find them, and explaining an algorithm to twenty-five people who are not yet convinced is a good test of whether you understand it. I placed second in the Hanoi City Informatics Olympiad in 2025.

I am applying to Manchester because the placement year is built into the degree rather than bolted on. I would like to spend a year inside a team that ships software to people who did not ask to be test users, because my own experience of that was four hundred classmates and a spreadsheet of complaints, and I would like to see how it is done properly. I am also aware that the first year assumes a level of formal reasoning I have only met through contests, and I expect that to be uncomfortable in a useful way.

I want to build things that work for people who are not thinking about the software at all. The bus stop is where that started.`;

/**
 * Ideas and Structure findings.
 *
 * Scenario-aware because severity feeds `statementStatus` through
 * `unresolvedCriticalCount`: a `problem` finding holds the statement at
 * `needs_attention`, which is correct behaviour and would otherwise stop the
 * `ready` scenario ever reaching the Submit Audit handoff. In `ready` the
 * programme-connection finding has been acted on, so it drops to a suggestion
 * rather than vanishing — the reader should still see what was improved.
 */
function ideasFindings(scenario: Scenario): StatementFinding[] {
  const ready = scenario === 'ready';

  return DEMO_IDEAS_FINDINGS.map((finding) => {
    if (finding.id !== 'f-3' || !ready) return finding;
    return {
      ...finding,
      severity: 'suggestion',
      explanation:
        'The placement year now sits alongside a second department-specific reason, so the programme connection reads as researched. A third reference would be optional polish, not a gap.',
    };
  });
}

const DEMO_IDEAS_FINDINGS: StatementFinding[] = [
  {
    id: 'f-1',
    category: 'Central idea',
    severity: 'strength',
    explanation:
      'The bus problem carries the whole statement and returns at the end without being laboured. The reader finishes with one clear image of how you think.',
    quote: 'It was working out which part of the problem was actually the problem.',
    suggestedAction: 'Keep this. Do not add a second organising metaphor.',
  },
  {
    id: 'f-2',
    category: 'Evidence',
    severity: 'strength',
    explanation:
      'Naming the failure mode — accurate at rush hour, useless at midday — is far more convincing than a claim of accuracy would be.',
    quote: 'it was accurate at rush hour and useless at midday',
    suggestedAction: 'Keep. This is the most credible sentence in the statement.',
  },
  {
    id: 'f-3',
    category: 'Programme connection',
    severity: 'problem',
    explanation:
      'The placement year is the only department-specific reason given, and it arrives in the second-to-last paragraph. Your target profile identifies it as the route to a graduate offer, so it is carrying more weight than its position suggests.',
    quote: 'I am applying to Manchester because the placement year is built into the degree',
    suggestedAction:
      'Move this reason earlier, or add one more specific reference to what the department teaches.',
    suggestedRevision:
      'I am applying to Manchester because the placement year is built into the degree rather than bolted on, and because the coursework weighting means I would be judged on things I have built rather than on exams alone.',
  },
  {
    id: 'f-4',
    category: 'Repetition',
    severity: 'suggestion',
    explanation:
      'The olympiad result appears here and in your CV. The statement spends a sentence restating a fact the reader already has.',
    quote: 'I placed second in the Hanoi City Informatics Olympiad in 2025.',
    suggestedAction:
      'Cut the result and keep the point about explaining algorithms, which the CV cannot show.',
    suggestedRevision:
      'Explaining an algorithm to twenty-five people who are not yet convinced is a good test of whether you understand it.',
  },
  {
    id: 'f-5',
    category: 'Reflection',
    severity: 'suggestion',
    explanation:
      'The handwriting paragraph states what you learned but does not say what you would do differently, which is the stronger form of the same move.',
    quote: 'the labelling taught me more than the architecture did',
    suggestedAction: 'Add one clause on what you would change about your approach now.',
  },
];

export const DEMO_OPENING_FINDINGS: StatementFinding[] = [
  {
    id: 'o-1',
    category: 'Specificity',
    severity: 'strength',
    explanation:
      'A named route and a concrete location in the first two sentences. The reader knows immediately that this is not a generic opening.',
    quote: 'Route 32 into central Hanoi ran to a timetable that everyone had quietly agreed to ignore',
    suggestedAction: 'Keep.',
  },
  {
    id: 'o-2',
    category: 'Authenticity',
    severity: 'strength',
    explanation:
      'The opening admits to standing at a bus stop guessing, which is an ordinary and therefore believable starting point.',
    quote: 'I had spent most of that year standing at the stop guessing.',
    suggestedAction: 'Keep.',
  },
  {
    id: 'o-3',
    category: 'Reader orientation',
    severity: 'suggestion',
    explanation:
      'The subject is not named until the third paragraph. An admissions reader scanning quickly may not reach it.',
    quote: 'What changed was not the bus.',
    suggestedAction:
      'Signal the subject within the first paragraph without abandoning the scene.',
  },
  {
    id: 'o-4',
    category: 'Unnecessary gimmicks',
    severity: 'strength',
    explanation:
      'No quotation, no dictionary definition, no rhetorical question. The opening earns attention with a detail instead.',
    quote: null,
    suggestedAction: 'Keep.',
  },
];

export const DEMO_AACC: AaccAssessment = {
  academic: {
    score: 72,
    explanation:
      'Formal reasoning is evidenced through contests rather than through coursework, and the statement is honest about that limit.',
    evidence: [
      'the first year assumes a level of formal reasoning I have only met through contests',
      'I placed second in the Hanoi City Informatics Olympiad in 2025.',
    ],
    missingEvidence: [
      'No reference to independent reading beyond the syllabus, which this department expects.',
    ],
    recommendedImprovement:
      'Name one book, paper or course you worked through on your own and what you took from it.',
  },
  activities: {
    score: 81,
    explanation:
      'Two sustained activities, both with specific outcomes rather than titles.',
    evidence: [
      'About four hundred of them did over that first term.',
      'Running the weekly sessions at my school\u2019s Informatics Club',
    ],
    missingEvidence: ['Nothing shows work sustained with a team rather than for an audience.'],
    recommendedImprovement:
      'Add one sentence about the inter-school contest, naming what you owned and who you worked with.',
  },
  character: {
    score: 86,
    explanation:
      'Willingness to do tedious work is shown rather than claimed, and the statement concedes its own weaknesses without fishing for credit.',
    evidence: [
      'so I labelled six thousand samples myself. It took weeks and most of it was tedious.',
      'The first version was wrong most of the time.',
    ],
    missingEvidence: [],
    recommendedImprovement:
      'No change needed. This is the strongest pillar and should not be diluted.',
  },
  contribution: {
    score: 64,
    explanation:
      'The bus predictor helped classmates and the club sessions helped members, but both are framed around what you learned rather than what others gained.',
    evidence: ['I put it behind a small web page so my classmates could use it.'],
    missingEvidence: [
      'No account of what the club was like before and after your involvement.',
      'No indication of whether the predictor is still running or maintained by anyone else.',
    ],
    recommendedImprovement:
      'Say what happened to the predictor after you left, or what the club retained. Contribution reads more strongly when it outlasts you.',
  },
};

export function makeStatementAnalysis(scenario: Scenario): StatementAnalysis | null {
  if (scenario === 'empty') return null;

  const ready = scenario === 'ready';

  return {
    id: 'analysis-1',
    statementId: 1,
    strategyId: 'strategy-1',
    // `partial` has been edited since: statement version is 4, this read 3.
    contentVersion: 3,
    overview: {
      communicates:
        'A student who treats debugging as the interesting part, evidenced by one project carried through three versions to real users.',
      strongestQuality:
        'Credibility. The statement names its own failures, which makes the successes believable.',
      mostImportantIssue:
        'The reasons are about computer science in general, not about this department. Only the placement year is specific to Manchester.',
      answersPrompt: ready ? 'yes' : 'partly',
    },
    ideasAndStructure: ideasFindings(scenario),
    opening: DEMO_OPENING_FINDINGS,
    aacc: DEMO_AACC,
    readiness: {
      state: ready ? 'ready' : 'needs_attention',
      checks: [
        {
          key: 'promptAnswered',
          passed: ready,
          detail: ready
            ? 'Both halves of the prompt are answered, with the department-specific reason now in the second paragraph.'
            : 'The "why computer science" half is answered well. The "what have you done" half is answered, but the department-specific reason arrives too late to count as an answer to why here.',
        },
        {
          key: 'wordLimit',
          passed: true,
          detail: `638 of ${DEMO_WORD_LIMIT} words.`,
        },
        {
          key: 'placeholderText',
          passed: true,
          detail: 'No placeholder or bracketed text found.',
        },
        {
          key: 'incompleteSentences',
          passed: true,
          detail: 'No fragments or unfinished sentences found.',
        },
        {
          key: 'unsupportedClaims',
          passed: true,
          detail: 'Every claim is tied to something in your profile or the draft itself.',
        },
        {
          key: 'profileContradictions',
          passed: true,
          detail: 'Dates, figures and results match your Glowbal profile.',
        },
        {
          key: 'repeatedSections',
          passed: ready,
          detail: ready
            ? 'No material is duplicated from your CV.'
            : 'The olympiad result is stated in both the CV and the statement.',
        },
        {
          key: 'programmeReferences',
          passed: ready,
          detail: ready
            ? 'Two department-specific references: the placement year and the coursework weighting.'
            : 'One department-specific reference only. Two or more reads as researched rather than assumed.',
        },
        {
          key: 'unresolvedFeedback',
          passed: ready,
          detail: ready
            ? 'All critical feedback has been accepted or dismissed.'
            : 'One problem-level finding is still unresolved.',
        },
      ],
    },
    model: 'demo-fixture',
    createdAt: '2026-07-27T10:05:00.000Z',
  };
}

/** Statement content version. Ahead of the analysis in `partial`. */
export function statementVersion(scenario: Scenario): number {
  return scenario === 'ready' ? 3 : 4;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}

// ── Fake AI latency ───────────────────────────────────────────────────────

/**
 * The demo's stand-in for a model call. Long enough that the loading states are
 * visible when demoing, short enough not to stall the walkthrough.
 */
export const FAKE_AI_MS = 1800;
export const FAKE_SAVE_MS = 900;
export const FAKE_EXPORT_MS = 2200;
