import type { Confidence } from './framework';
import type { CompetencyProfile } from './competency';

/**
 * F5 — Programme Fit Framework.
 *
 * Everything the Programme Fit page renders: the university header, why this
 * course was recommended, what it asks for, what it costs, and where the
 * student falls short.
 *
 * ─── EVERY FIELD HERE IS A REAL COLUMN ───────────────────────────────────────
 *
 * The `universities` row already carries rankings, entry requirements, costs
 * and scholarship notes; `course_applications` carries the course itself. This
 * framework arranges them and pairs them with the competency scores. It does
 * not ask a model to describe a university it has not read about, which is the
 * one thing in this whole pipeline most likely to produce confident nonsense
 * about a real institution a student is about to spend money applying to.
 *
 * ─── WHY THE REQUIREMENTS LIST HAS NO TICKS ──────────────────────────────────
 *
 * The mockup draws a tick against every entry requirement — GPA, TOEFL,
 * SAT/ACT, difficulty — which reads as "you meet this". We cannot know that.
 * `universities.gpa_range` is free text ("3.5+/4.0 equivalent") and the
 * student's `predicted_grades` is free text in whatever system their school
 * uses. Comparing the two reliably is not a formatting problem, it is a
 * grade-conversion problem across every education system we serve.
 *
 * So `RequirementRow` has no met/unmet flag. The rows state what the course
 * asks for, and the academic competency score carries the standing. A tick that
 * meant "we did not check" would be the single most damaging thing on this
 * page: a student who applies believing they meet a requirement they miss has
 * been actively harmed by the report.
 */

export type UniversityFacts = {
  name: string;
  localName: string | null;
  country: string | null;
  /** "Private" / "Public". */
  type: string | null;
  qsRank: number | null;
  theRank: number | null;
  imageUrl: string | null;
  logoUrl: string | null;
  /** Editorial fields from the universities import. */
  strengths: string | null;
  specificInsight: string | null;
  teachingStyle: string | null;
  bestFor: string | null;
  /** Entry requirements. */
  gpaRange: string | null;
  englishRequirement: string | null;
  standardisedTest: string | null;
  admissionDifficulty: string | null;
  acceptRate: string | null;
  /** Costs. */
  tuitionUsd: string | null;
  livingCostUsd: string | null;
  housing: string | null;
  scholarship: string | null;
};

export type ProgrammeFacts = {
  courseName: string;
  universityName: string;
  degreeLevel: string | null;
  subject: string | null;
  studyMode: string | null;
  intake: string | null;
  deadline: string | null;
  tuitionFee: string | null;
  entryRequirementsSummary: string | null;
  englishRequirementsSummary: string | null;
  courseUrl: string | null;
};

/** One row of the entry-requirements list. Deliberately has no met/unmet — see the header. */
export type RequirementRow = {
  label: string;
  value: string;
};

export type ProgrammeFit = {
  /** 0-100. The same figure as match-insights' weighted current score. */
  overallFitPercent: number;
  /** 0-100 ceiling if the gaps close. */
  goalFitPercent: number;
  /**
   * 0-100. The design's second ring. Sourced from the `personal` competency,
   * which is the one that scores how the student's way of working lines up
   * with how the course teaches — not a separate model.
   */
  personaAlignmentPercent: number;
  personaAlignmentSummary: string | null;
  /** Why this course, drawn from the university's own editorial fields. */
  whyRecommended: string[];
  programmeOverview: string[];
  requirements: RequirementRow[];
  costs: RequirementRow[];
  scholarshipNote: string | null;
  /** Where the student falls short — the union of every competency's gaps. */
  profileGaps: string[];
  university: UniversityFacts | null;
  programme: ProgrammeFacts;
  confidence: Confidence;
};

/** Drop nulls and blanks so a section with nothing behind it renders as absent
    rather than as a row of dashes. */
function rows(entries: readonly [string, string | null | undefined][]): RequirementRow[] {
  return entries
    .filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
    .map(([label, value]) => ({ label, value: value.trim() }));
}

function present(...values: (string | null | undefined)[]): string[] {
  return values.filter((value): value is string => Boolean(value?.trim())).map((v) => v.trim());
}

export function buildProgrammeFit(args: {
  competencies: CompetencyProfile;
  university: UniversityFacts | null;
  programme: ProgrammeFacts;
  overallFitPercent: number;
  goalFitPercent: number;
  confidence: Confidence;
}): ProgrammeFit {
  const { competencies, university, programme, overallFitPercent, goalFitPercent, confidence } =
    args;

  const persona = competencies.competencies.find((c) => c.key === 'personal');

  return {
    overallFitPercent,
    goalFitPercent,
    personaAlignmentPercent: persona?.assessed ? persona.score : 0,
    personaAlignmentSummary: persona?.assessed ? persona.summary : null,

    whyRecommended: present(
      university?.specificInsight,
      university?.bestFor,
      university?.strengths,
      university?.teachingStyle,
    ),

    programmeOverview: present(
      programme.degreeLevel,
      programme.subject,
      programme.studyMode,
      programme.intake ? `Intake: ${programme.intake}` : null,
      programme.deadline ? `Deadline: ${programme.deadline}` : null,
      programme.entryRequirementsSummary,
    ),

    requirements: rows([
      ['GPA', university?.gpaRange],
      ['English', university?.englishRequirement ?? programme.englishRequirementsSummary],
      ['Standardised tests', university?.standardisedTest],
      ['Acceptance rate', university?.acceptRate],
      ['Difficulty', university?.admissionDifficulty],
    ]),

    costs: rows([
      ['Tuition', university?.tuitionUsd ?? programme.tuitionFee],
      ['Living costs', university?.livingCostUsd],
      ['Housing', university?.housing],
    ]),

    scholarshipNote: university?.scholarship?.trim() || null,

    // De-duplicated: two competencies commonly name the same gap, and the same
    // sentence twice in one list reads as a rendering bug.
    profileGaps: [...new Set(competencies.competencies.flatMap((c) => c.gaps))],

    university,
    programme,
    confidence,
  };
}
