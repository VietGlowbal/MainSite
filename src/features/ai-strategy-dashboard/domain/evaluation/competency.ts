import type { PillarBreakdown, PillarKey } from '@/lib/match-insights';
import type { Confidence } from './framework';

/**
 * F2 — Admissions Competency Framework.
 *
 * The competencies an admissions officer actually weighs, scored from the
 * evidence already gathered.
 *
 * ─── THIS IS A RELABELLING OF match-insights, NOT A SECOND SCORING MODEL ─────
 *
 * `match-insights.ts` already scores five weighted pillars with a current and a
 * ceiling score, per-pillar strengths, gaps and improvement actions, and
 * persists them on `application_match_analyses`. F2 renames those five into
 * admissions language and nothing else.
 *
 * The temptation was to define the eight or ten competencies a real admissions
 * rubric uses — intellectual curiosity, resilience, communication, and so on.
 * That would have meant deriving ten numbers from five, which is not analysis;
 * it is the same five scores wearing more names, with the added problem that a
 * student could not tell which were measured and which were inferred. Five
 * competencies backed by five real scores is a smaller claim and a true one.
 *
 * ─── `assessed` IS LOAD-BEARING ──────────────────────────────────────────────
 *
 * A pillar with no input (no essay written yet, no activities entered) comes
 * back `assessed: false` with a score of zero. Rendering that as "Communication:
 * 0%" would tell a student they had failed at something they had not yet
 * attempted. Every consumer must branch on `assessed` before showing a number —
 * `unassessed` below exists so a UI can list those separately rather than
 * filtering them into silence.
 */

export type CompetencyKey = PillarKey;

export type Competency = {
  key: CompetencyKey;
  /** Admissions-facing name. */
  label: string;
  /** What this competency covers, for the student. */
  blurb: string;
  /** 0-100. Meaningless unless `assessed`. */
  score: number;
  /** 0-100 realistic ceiling if the gaps are closed. Always >= score. */
  ceiling: number;
  assessed: boolean;
  summary: string;
  strengths: string[];
  gaps: string[];
};

export type CompetencyProfile = {
  competencies: Competency[];
  /** Scored competencies, strongest first. */
  assessed: Competency[];
  /** Competencies with no input yet — a prompt to continue, not a low score. */
  unassessed: Competency[];
  /** Biggest gap between score and ceiling: where effort pays most. */
  biggestOpportunity: Competency | null;
  confidence: Confidence;
};

const COMPETENCY_META: Record<CompetencyKey, { label: string; blurb: string }> = {
  academic: {
    label: 'Academic standing',
    blurb: 'Grades, subjects and test scores against what the course asks for.',
  },
  activities: {
    label: 'Wider engagement',
    blurb: 'What you have done outside the classroom, and how consistently.',
  },
  essays: {
    label: 'Written voice',
    blurb: 'How clearly your statement makes the case only you could make.',
  },
  impact: {
    label: 'Demonstrated impact',
    blurb: 'Evidence that something changed because you were involved.',
  },
  personal: {
    label: 'Personal fit',
    blurb: 'How well who you are lines up with how this course teaches.',
  },
};

export const COMPETENCY_ORDER: readonly CompetencyKey[] = [
  'academic',
  'essays',
  'activities',
  'impact',
  'personal',
];

export function buildCompetencyProfile(
  pillars: Record<PillarKey, PillarBreakdown>,
  confidence: Confidence,
): CompetencyProfile {
  const competencies: Competency[] = COMPETENCY_ORDER.map((key) => {
    const pillar = pillars[key];
    const meta = COMPETENCY_META[key];
    return {
      key,
      label: meta.label,
      blurb: meta.blurb,
      score: pillar.current,
      // match-insights guarantees max >= current, but a stored row predates any
      // such guarantee; clamping here means a malformed row cannot render a
      // ceiling below the score, which would read as a bug to the student.
      ceiling: Math.max(pillar.current, pillar.max),
      assessed: pillar.assessed,
      summary: pillar.summary,
      strengths: pillar.strengths,
      gaps: pillar.gaps,
    };
  });

  const assessed = competencies
    .filter((competency) => competency.assessed)
    .sort((a, b) => b.score - a.score);

  const biggestOpportunity =
    assessed.length === 0
      ? null
      : assessed.reduce((best, current) =>
          current.ceiling - current.score > best.ceiling - best.score ? current : best,
        );

  return {
    competencies,
    assessed,
    unassessed: competencies.filter((competency) => !competency.assessed),
    biggestOpportunity,
    confidence,
  };
}
