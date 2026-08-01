/**
 * The `/ai-strategy` explainer's content — three areas, thirteen steps.
 *
 * ⚠️ EVERY STEP HERE DESCRIBES SOMETHING THE CODE ACTUALLY DOES. This page
 * exists to explain the product to a student who has not used it, which makes
 * it the single easiest place in the repo to accidentally ship a promise the
 * software does not keep. Each entry below was written by reading the
 * implementation, and carries a `source` pointing at it so the next person can
 * re-check rather than trust this file. If you change one of those files,
 * change the step.
 *
 * Two things are deliberately NOT claimed anywhere in this content:
 *   - that anything happens automatically in the background. Re-analysis is a
 *     button the student presses (see the note on Requirement 14.3-14.4 in
 *     .kiro/specs/ai-strategy-dashboard/tasks.md).
 *   - that GlowBal submits an application, or has any relationship with the
 *     universities. It does not. Students apply on the university's own site;
 *     every step that touches that says so.
 *
 * `videoSrc` is null on every step today. The owner is producing the demo
 * clips separately, and the UI renders an explicit labelled placeholder
 * rather than a fake player when one is missing — a mocked-up video frame
 * with no video in it is exactly the "looks finished but isn't" problem the
 * old /ai-strategy page had. `videoFileName` is the name the finished clip
 * should be saved as, so dropping them in later is a one-line change per step.
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
      'Search real universities, read the honest detail on each one, and find the course you actually want to apply to.',
    steps: [
      {
        number: '1.1',
        title: 'Search the university directory',
        summary:
          'Search by name, or filter by where you want to study and what you want to study, and browse the results.',
        details: [
          'Search by university name',
          'Filter by destination country and by subject area',
          'Save any university to your own shortlist as you go',
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
        title: 'Understand the scholarships',
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
        title: 'Pick your exact course on the university’s site',
        summary:
          'You apply through the university, not through GlowBal. So the last step here is choosing the specific course page you want — and copying its link.',
        details: [
          'Open the university’s official site from its GlowBal profile',
          'Choose the exact course and year you want to apply for',
          'Copy that course page’s URL — it is what the next area needs',
        ],
        href: null,
        linkLabel: null,
        videoSrc: null,
        videoFileName: 'guide-1-4-pick-a-course.mp4',
        source: 'src/app/universities/[id] official-site link; /my-universities/program picker',
      },
    ],
  },
  {
    id: 'apply',
    number: 2,
    title: 'Applying via GlowBal',
    summary:
      'Paste that course link and GlowBal turns the official page into a working application plan, then scores how well you fit it.',
    steps: [
      {
        number: '2.1',
        title: 'Paste the course link',
        summary:
          'One box. Paste the URL of the course page you chose, and GlowBal starts building your application from it.',
        details: [
          'Any official course page URL',
          'You can run several courses at once — each gets its own plan',
          'Already-imported courses are recognised instead of re-read',
        ],
        href: '/apply',
        linkLabel: 'Go to Apply',
        videoSrc: null,
        videoFileName: 'guide-2-1-paste-course-link.mp4',
        source: 'src/app/apply/page.tsx, src/app/api/applications/from-course-url/route.ts',
      },
      {
        number: '2.2',
        title: 'AI reads the page and builds your plan',
        summary:
          'GlowBal reads the official course page and turns it into the facts, the requirements and a task checklist — organised into five stages.',
        details: [
          'Five stages: Research, Check eligibility, Prepare documents, Improve application, Submit',
          'Course facts, entry requirements and deadlines pulled from the page',
          'Any scholarships that page mentions, captured alongside it',
          'Nothing is invented — anything the page does not say is left blank, never guessed',
        ],
        href: '/apply',
        linkLabel: 'Go to Apply',
        videoSrc: null,
        videoFileName: 'guide-2-2-ai-builds-plan.mp4',
        source: 'src/lib/course-parser/extract-course.ts (STAGE_TEMPLATE)',
      },
      {
        number: '2.3',
        title: 'Add your side of it',
        summary:
          'Upload the documents you already have and fill in your profile. This is what GlowBal compares against the course.',
        details: [
          'Upload your CV, personal statement and supporting documents',
          'Your grades, tests, and English qualifications',
          'Everything you add here is reused by every course you apply to',
        ],
        href: '/profile/documents',
        linkLabel: 'Add your documents',
        videoSrc: null,
        videoFileName: 'guide-2-3-add-your-information.mp4',
        source: 'src/app/profile/*, uploaded_documents',
      },
      {
        number: '2.4',
        title: 'See how well you fit the course',
        summary:
          'A match score, broken into the five things admissions actually weighs — and, importantly, how high you could realistically get.',
        details: [
          'Scored across Academic, Activities, Essays, Impact and Personal',
          'Your score now, and the realistic ceiling if you act on the advice',
          'A confidence level, so a score built on thin evidence says so',
        ],
        href: '/apply',
        linkLabel: 'Go to Apply',
        videoSrc: null,
        videoFileName: 'guide-2-4-match-score.mp4',
        source: 'src/lib/match-insights.ts (MATCH_PILLARS)',
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
        title: 'Answer questions about you',
        summary:
          'A structured set of questions — not a blank box — covering the things that actually shape an application.',
        details: [
          'Your background, education and grades',
          'Where you want to study and what you are aiming for',
          'Your interests, and how you learn best',
          'Starter questions for your personal statement',
        ],
        href: '/ai-strategy/reflection',
        linkLabel: 'Start the questions',
        videoSrc: null,
        videoFileName: 'guide-3-1-personal-summary.mp4',
        source: 'src/app/ai-strategy/reflection/reflection-about-form.tsx',
      },
      {
        number: '3.2',
        title: 'Add your achievements',
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
        videoFileName: 'guide-3-2-achievements.mp4',
        source: 'src/app/ai-strategy/reflection/achievements/reflection-evidence-form.tsx',
      },
      {
        number: '3.3',
        title: 'GlowBal builds two profiles',
        summary:
          'One of you, one of the course — because a strong applicant for one course is an average one for another. Takes about 30–60 seconds.',
        details: [
          'Your profile: strengths, growth areas, what makes you competitive, and how to position yourself',
          'The course profile: how you match on entry requirements, experience and personal qualities',
          'What is missing, where the admissions risk sits, and how confident the analysis is',
        ],
        href: null,
        linkLabel: null,
        videoSrc: null,
        videoFileName: 'guide-3-3-two-profiles.mp4',
        source:
          'src/lib/ai/strategy-dashboard/applicant-analysis.ts, features/ai-strategy-dashboard/domain/course-match.ts',
      },
      {
        number: '3.4',
        title: 'Get your improvement plan',
        summary:
          'Your weak areas become a specific, ordered list of things to do — each one tied to the part of your application it lifts.',
        details: [
          'Grouped by Academics, Activities, Personal Statement, Impact and Personal',
          'Each action carries a priority and how much it would move your score',
          'Your match now against the score you are aiming for',
          'Mark things in progress, done, or blocked as you work',
        ],
        href: null,
        linkLabel: null,
        videoSrc: null,
        videoFileName: 'guide-3-4-improvement-plan.mp4',
        source: 'src/features/ai-strategy-dashboard/ui/{strategy-category-board,recommendation-table}.tsx',
      },
      {
        number: '3.5',
        title: 'Work through it with an AI coach',
        summary:
          'Every action opens into detail, with a coach that knows which course you are applying to and what that action is for.',
        details: [
          'Ask the coach about any single recommendation and get specific answers',
          'Upload evidence once you have done something',
          'Re-run the analysis when you are ready, and watch the score move',
          'Completed work is never overwritten when the plan updates',
        ],
        href: null,
        linkLabel: null,
        videoSrc: null,
        videoFileName: 'guide-3-5-ai-coach.mp4',
        source:
          'src/features/ai-strategy-dashboard/ui/{ai-coach-panel,evidence-upload}.tsx, api/.../recommendations/[recId]/coach',
      },
    ],
  },
];

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
