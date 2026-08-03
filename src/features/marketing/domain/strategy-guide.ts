/**
 * The `/ai-strategy` explainer's content — three areas, fourteen steps.
 *
 * ⚠️ EVERY STEP HERE DESCRIBES SOMETHING THE CODE ACTUALLY DOES. This page
 * exists to explain the product to a student who has not used it, which makes
 * it the single easiest place in the repo to ship a promise the software does
 * not keep. Each entry carries a `source` pointing at the implementation it
 * was read from, so the next person can re-check rather than trust this file.
 * If you change one of those files, change the step.
 *
 * ─── THIS FILE HAS ALREADY BEEN WRONG ONCE. READ THIS BEFORE EDITING. ────────
 *
 * The first version (#131) described the journey as: pick a course on the
 * university's own website, copy its URL, paste it into /apply. That was the
 * flow until 01/08, when the paste-a-course-URL bar and the course-search
 * modal were REMOVED from /apply and applications started being created from
 * a saved university instead (`/api/applications/from-saved-university`).
 * The API that reads a pasted URL still exists, so grepping for it finds a
 * live endpoint and suggests the flow is current. It is not — nothing in the
 * UI posts to it any more except the optional fallback in the subject picker
 * (step 2.3 below).
 *
 * The lesson, and the rule for anyone editing this file: an endpoint existing
 * is not evidence a student can reach it. Verify against the PAGE a student
 * actually lands on, not the route handler behind it.
 *
 * ─── WHAT IS DELIBERATELY NOT CLAIMED ────────────────────────────────────────
 *
 *   - that anything re-analyses automatically in the background. It is a
 *     button the student presses (.kiro/specs/ai-strategy-dashboard/tasks.md,
 *     the note on Requirement 14.3-14.4).
 *   - that GlowBal submits an application, or has any relationship with the
 *     universities. It does not.
 *   - the calendar view and the kanban view. Neither exists at all. The task
 *     plan is a table today.
 *
 *     ⚠️ The CV builder and statement writer USED to be on this list, for the
 *     reason that they existed but were unreachable from the Strategy. They are
 *     now wired up — the Dashboard's category board links to both, and the
 *     recommendation table's "Help" column routes an essays-pillar task to the
 *     writer (see ai-strategy-dashboard/domain/strategy-tool.ts). So the guide
 *     MAY now describe them. It still does not, because the steps below are
 *     paired with demo clips the owner is producing separately and adding a
 *     step means adding a `videoFileName` for it; that is a content decision,
 *     not a code one. The blocker is a clip, no longer a lie.
 *   - anything about payment. The owner confirmed (01/08) that a paywall is
 *     planned for the Strategy — after the application stage, i.e. between
 *     area 2 and area 3 below — but is deliberately not being built while the
 *     product is still being tested. There is no entitlement check on any
 *     /ai-strategy route today, so promising one here would be inventing it.
 *
 * `videoSrc` is null on every step. The owner is producing the demo clips
 * separately, and the UI renders an explicit labelled placeholder rather than
 * a fake player when one is missing — a mocked-up video frame with no video in
 * it is exactly the "looks finished but isn't" problem the original
 * /ai-strategy page had. `videoFileName` is the name the finished clip should
 * be saved as, so dropping them in later is one field per step.
 */

export type GuideStep = {
  /** "1.1", "2.4" — shown in the step list and used as a React key. */
  readonly number: string;
  readonly title: string;
  /** One or two sentences. Plain student-facing language, no feature names. */
  readonly summary: string;
  /** Concrete specifics — the things a student would otherwise have to
      discover by clicking. Rendered as a checklist. */
  readonly details: readonly string[];
  /** Where in the app this step happens; rendered as a link when set. */
  readonly href: string | null;
  readonly linkLabel: string | null;
  /** Under /public once produced. Null renders the placeholder. */
  readonly videoSrc: string | null;
  readonly videoFileName: string;
  /** The implementation this step describes. Not rendered — it is here so the
      claim can be re-verified against code rather than taken on trust. */
  readonly source: string;
};

export type GuideArea = {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  /** The area's promise, in one sentence. */
  readonly summary: string;
  readonly steps: readonly GuideStep[];
};

export const STRATEGY_GUIDE: readonly GuideArea[] = [
  {
    id: 'find',
    number: 1,
    title: 'Finding your universities',
    summary:
      'Search real universities, read the honest detail on each one, and save the ones worth your time.',
    steps: [
      {
        number: '1.1',
        title: 'Search the university directory',
        summary:
          'Search by name, or filter by where you want to study and what you want to study, and browse the results.',
        details: [
          'Search by university name',
          'Filter by destination country and by subject area',
          'Every result opens into a full profile, not a stub',
        ],
        href: '/universities',
        linkLabel: 'Search universities',
        videoSrc: null,
        videoFileName: 'guide-1-1-search-universities.mp4',
        source: 'src/app/universities/university-list-client.tsx',
      },
      {
        number: '1.2',
        title: 'Open a university and read the detail',
        summary:
          'Each profile collects what a student actually needs to decide, in one place, instead of across a dozen tabs.',
        details: [
          'Overview, subjects taught, and what getting in requires',
          'Campus and location, career outcomes after graduation',
          '“The honest view” — the trade-offs, not just the sales pitch',
          'Mentors you can ask, where any are listed for that university',
        ],
        href: '/universities',
        linkLabel: 'Browse universities',
        videoSrc: null,
        videoFileName: 'guide-1-2-university-detail.mp4',
        source: 'src/app/universities/[id]/university-detail.tsx',
      },
      {
        number: '1.3',
        title: 'Check the scholarships',
        summary:
          'Scholarships are listed against the university that offers them, with the detail that decides whether you are eligible.',
        details: [
          'What kind of funding it is, and who is eligible',
          'The deadline, where one is published',
          'A link to the official page, so you can verify every figure yourself',
        ],
        href: '/scholarships',
        linkLabel: 'See scholarships',
        videoSrc: null,
        videoFileName: 'guide-1-3-scholarships.mp4',
        source: 'src/app/universities/[id]/university-detail.tsx (costs section), /scholarships',
      },
      {
        number: '1.4',
        title: 'Save the ones you want',
        summary:
          'Save a university and it goes to My Portal. That saved list is where every application starts — you never need to leave the platform to begin one.',
        details: [
          'Save from the search results or from the university’s own profile',
          'Saved universities collect in My Portal, ready to plan',
          'Save as many as you like — you choose which to act on later',
        ],
        href: '/universities',
        linkLabel: 'Start saving universities',
        videoSrc: null,
        videoFileName: 'guide-1-4-save-universities.mp4',
        source: 'src/app/api/home/save-university/route.ts (user_universities)',
      },
    ],
  },
  {
    id: 'apply',
    number: 2,
    title: 'Building your application',
    summary:
      'From your saved list, GlowBal builds a real application for one course — the steps to follow, and how well you currently fit.',
    steps: [
      {
        number: '2.1',
        title: 'Open My Portal',
        summary:
          'Everything you have saved, and every application you have started, in one place.',
        details: [
          'Your saved universities, ready to turn into applications',
          'Applications already in progress, with how far along each one is',
          'Pick the university you want to work on first',
        ],
        href: '/apply',
        linkLabel: 'Open My Portal',
        videoSrc: null,
        videoFileName: 'guide-2-1-my-portal.mp4',
        source: 'src/app/apply/page.tsx, saved-list-section.tsx',
      },
      {
        number: '2.2',
        title: 'Attach a scholarship',
        summary:
          'Pick the scholarship you are aiming for at that university, so the plan is built around what it actually asks of you.',
        details: [
          'Choose from the scholarships listed for that university',
          'See what it funds and who is eligible before you commit to it',
          'You can plan without one if none fit',
        ],
        href: '/apply',
        linkLabel: 'Open My Portal',
        videoSrc: null,
        videoFileName: 'guide-2-2-attach-scholarship.mp4',
        source: 'src/app/apply/saved-list-section.tsx (ScholarshipOption)',
      },
      {
        number: '2.3',
        title: 'Choose your subject',
        summary:
          'Pick the subject you want to study there. For universities whose course catalogue we hold, you choose straight from the list.',
        details: [
          'Choose from that university’s real programme list where we have it',
          'Optional: paste a course link instead — for universities outside the catalogue, that is what unlocks a fully AI-read plan',
          'Either way you stay on GlowBal; the link is a shortcut, not a requirement',
        ],
        href: '/apply',
        linkLabel: 'Open My Portal',
        videoSrc: null,
        videoFileName: 'guide-2-3-choose-subject.mp4',
        source: 'src/app/my-universities/program/program-picker.tsx',
      },
      {
        number: '2.4',
        title: 'GlowBal builds your application',
        summary:
          'Press “Plan my application” and you get a real, structured application for that course — the exact steps to follow, in order.',
        details: [
          'Five stages: Research, Check eligibility, Prepare documents, Improve application, Submit',
          'Each stage carries the specific tasks that course needs from you',
          'Nothing is invented — anything we cannot establish is left blank, never guessed',
        ],
        href: '/apply',
        linkLabel: 'Open My Portal',
        videoSrc: null,
        videoFileName: 'guide-2-4-build-application.mp4',
        source:
          'src/app/api/applications/from-saved-university/route.ts, lib/course-parser/extract-course.ts (STAGE_TEMPLATE)',
      },
      {
        number: '2.5',
        title: 'See how well you fit',
        summary:
          'At the bottom of your application, upload what you have and get a match score for that specific course.',
        details: [
          'Upload your CV, personal statement and supporting documents',
          'Scored across Academic, Activities, Essays, Impact and Personal',
          'Your score now, and the realistic ceiling if you act on the advice',
          'A confidence level, so a score built on thin evidence says so',
        ],
        href: '/apply',
        linkLabel: 'Open My Portal',
        videoSrc: null,
        videoFileName: 'guide-2-5-match-insights.mp4',
        source:
          'src/components/apply/match-insights/MatchInsightsPanel.tsx, src/lib/match-insights.ts',
      },
    ],
  },
  {
    id: 'strategy',
    number: 3,
    title: 'GlowBal Strategy',
    summary:
      'The part that changes your odds: a profile of you, a profile of the course, and a plan that closes the gap between them.',
    steps: [
      {
        number: '3.1',
        title: 'Strengthen your application',
        summary:
          'Your application tells you where you stand. The Strategy is how you improve it — start it from the application itself.',
        details: [
          'Opens from “Ready to strengthen this application?” on any application',
          'Built for that one course, not a generic checklist',
          'Starts with a walkthrough of what the Strategy will do before you commit',
        ],
        href: null,
        linkLabel: null,
        videoSrc: null,
        videoFileName: 'guide-3-1-strengthen-application.mp4',
        source:
          'src/app/apply/[applicationId]/application-workspace-v2.tsx, features/ai-strategy-dashboard/ui/strategy-home.tsx',
      },
      {
        number: '3.2',
        title: 'Confirm your details',
        summary:
          'A structured set of questions — not a blank box — covering the things that actually shape an application.',
        details: [
          'Your background, education and grades',
          'Where you want to study and what you are aiming for',
          'Your interests, and how you learn best',
          'Starter questions for your personal statement',
        ],
        href: '/ai-strategy/reflection',
        linkLabel: 'See the questions',
        videoSrc: null,
        videoFileName: 'guide-3-2-confirm-details.mp4',
        source: 'src/app/ai-strategy/reflection/reflection-about-form.tsx',
      },
      {
        number: '3.3',
        title: 'Add achievements, projects and grades',
        summary:
          'Awards, competitions, projects, volunteering, work. The specifics — because “I was in a club” and “I ran the club” score very differently.',
        details: [
          'Academic achievements with the level, year and how competitive it was',
          'Extracurricular activities, projects and employment',
          'Upload your CV alongside them',
          'Genuinely have none yet? You can finish this step empty and still continue',
        ],
        href: '/ai-strategy/reflection/achievements',
        linkLabel: 'Add achievements',
        videoSrc: null,
        videoFileName: 'guide-3-3-achievements.mp4',
        source: 'src/app/ai-strategy/reflection/achievements/reflection-evidence-form.tsx',
      },
      {
        number: '3.4',
        title: 'Get two AI reports',
        summary:
          'One about you, one about the course — because a strong applicant for one course is an average one for another. Takes about 30–60 seconds.',
        details: [
          'Your report: personality, strengths, growth areas, and what makes you competitive',
          'The course report: how you match on entry requirements, experience and personal qualities',
          'What the course is looking for that you have not shown yet',
          'Where the admissions risk sits, and how confident the analysis is',
        ],
        href: null,
        linkLabel: null,
        videoSrc: null,
        videoFileName: 'guide-3-4-two-reports.mp4',
        source:
          'src/lib/ai/strategy-dashboard/applicant-analysis.ts, features/ai-strategy-dashboard/domain/course-match.ts',
      },
      {
        number: '3.5',
        title: 'Work your improvement plan',
        summary:
          'Your weak areas become a specific, ordered list of things to do — each one tied to the part of your application it lifts.',
        details: [
          'Grouped by Academics, Activities, Personal Statement, Impact and Personal',
          'Each action carries a priority and how much it would move your score',
          'Mark things in progress, done, or blocked as you work',
          'Ask the AI coach about any single action, upload evidence when it is done, then re-run the analysis and watch the score move',
        ],
        href: null,
        linkLabel: null,
        videoSrc: null,
        videoFileName: 'guide-3-5-improvement-plan.mp4',
        source:
          'src/features/ai-strategy-dashboard/ui/{strategy-category-board,recommendation-table,ai-coach-panel,evidence-upload}.tsx',
      },
    ],
  },
];

/**
 * One area on its own, for a page that explains a single stage rather than the
 * whole journey — `/ai-strategy`, which since 03/08 is area 3 and nothing else.
 * `/how-it-works` is the page that renders all three.
 *
 * IT THROWS ON AN UNKNOWN ID, deliberately. The only way to reach that is to
 * rename an area above without following it here, and this is content read at
 * render time on a server component: an exception names the mistake in the
 * build output, whereas returning `undefined` would ship a page with an empty
 * walkthrough and a hero promising steps that never appear. That failure mode
 * is exactly what the ⚠️ at the top of this file is about.
 */
export function guideArea(id: string): GuideArea {
  const area = STRATEGY_GUIDE.find((candidate) => candidate.id === id);
  if (area === undefined) {
    const known = STRATEGY_GUIDE.map((candidate) => candidate.id).join(', ');
    throw new Error(`Unknown guide area "${id}". The ids are: ${known}.`);
  }
  return area;
}

/**
 * Which step is most relevant to the page a student is currently on — what the
 * floating help button opens to, so pressing "?" on the subject picker starts
 * at "Choose your subject" rather than at step 1.1 every time.
 *
 * ORDER MATTERS: matched top-down, most specific first. `/apply/[id]` is the
 * application workspace and must be tested before the bare `/apply` portal, or
 * every application would open the guide at "Open My Portal".
 *
 * Returns 0 for anything unmatched, which is the honest default — the start of
 * the journey — rather than guessing.
 */
const PATH_TO_STEP: readonly (readonly [RegExp, string])[] = [
  // Area 3 — most specific first: the strategy sub-pages sit under the same
  // /ai-strategy/[id] prefix as the strategy landing page.
  [/^\/ai-strategy\/[^/]+\/strategy\/dashboard/, '3.5'],
  [/^\/ai-strategy\/[^/]+\/strategy\/recommendations/, '3.5'],
  [/^\/ai-strategy\/[^/]+\/strategy\/analysis/, '3.4'],
  [/^\/ai-strategy\/[^/]+\/strategy\/intro/, '3.4'],
  [/^\/ai-strategy\/reflection\/achievements/, '3.3'],
  [/^\/ai-strategy\/reflection/, '3.2'],
  [/^\/ai-strategy\/[^/]+\/strategy/, '3.1'],
  /* The CV builder and the statement writer are both reached FROM the
     improvement plan (the category board links to them, and an essays-pillar
     task routes to the writer), so 3.5 is where a student on either of them
     came from. Neither tool has a step of its own — see the "deliberately not
     claimed" note at the top of this file for why. */
  [/^\/ai-strategy\/[^/]+\/cv/, '3.5'],
  [/^\/ai-strategy\/[^/]+\/statement/, '3.5'],
  // Area 2
  [/^\/my-universities\/program/, '2.3'],
  [/^\/apply\/[^/]+/, '2.4'],
  [/^\/apply/, '2.1'],
  [/^\/profile\/documents/, '2.5'],
  // Area 1
  [/^\/scholarships/, '1.3'],
  [/^\/universities\/[^/]+/, '1.2'],
  [/^\/universities/, '1.1'],
];

export function stepIndexForPath(pathname: string): number {
  const flat = flattenGuide(STRATEGY_GUIDE);
  for (const [pattern, stepNumber] of PATH_TO_STEP) {
    if (!pattern.test(pathname)) continue;
    const index = flat.findIndex((entry) => entry.step.number === stepNumber);
    if (index !== -1) return index;
  }
  return 0;
}

/**
 * Where a step's link goes, in plain words — rendered under the button so a
 * student knows what pressing it does before they lose the page they are on.
 *
 * KEYED ON `href`, NOT STORED PER STEP, and that is the point: a caption held
 * next to the step could end up describing one destination while the link
 * pointed at another, which is the precise class of drift this file has
 * already suffered once. An unrecognised href gets no caption rather than a
 * guessed one.
 */
const DESTINATION_LABELS: Readonly<Record<string, string>> = {
  '/universities': 'the university directory',
  '/scholarships': 'the scholarship list',
  '/apply': 'My Portal',
  '/ai-strategy/reflection': 'the questions about you',
  '/ai-strategy/reflection/achievements': 'your achievements',
};

export function destinationLabel(href: string): string | null {
  return DESTINATION_LABELS[href] ?? null;
}

/** Flat step list with its area — what the scroll position maps onto. */
export type FlatGuideStep = {
  readonly area: GuideArea;
  readonly step: GuideStep;
  /** Index of this step within its own area, for the step list. */
  readonly indexInArea: number;
};

export function flattenGuide(areas: readonly GuideArea[]): FlatGuideStep[] {
  const flat: FlatGuideStep[] = [];
  for (const area of areas) {
    area.steps.forEach((step, indexInArea) => {
      flat.push({ area, step, indexInArea });
    });
  }
  return flat;
}

export const GUIDE_STEP_COUNT = flattenGuide(STRATEGY_GUIDE).length;
