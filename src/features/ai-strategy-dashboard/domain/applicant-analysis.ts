/**
 * Applicant Analysis — the candidate-portrait report (V2 Stage 3, Report 1).
 *
 * Mirrors `applicant_analyses` (append-only; latest `createdAt` per
 * `applicationId` is "the" analysis, same convention as `cv_reviews` /
 * `statement_analyses` in the ai-application-strategy spec). This module is
 * pure — it knows the shape of the report and nothing about Supabase, the AI
 * call, or React.
 */

export type ApplicantAnalysisInputsPresent = {
  personalSummary: boolean;
  achievements: boolean;
  evidence: boolean;
};

export type ApplicantAnalysis = {
  id: string;
  applicationId: string;
  profileVersion: number;
  personalitySummary: string | null;
  learningStyle: string[];
  academicStrengths: string[];
  growthAreas: string[];
  motivationAnalysis: string | null;
  competitiveAdvantages: string[];
  suggestedPositioning: string | null;
  /** 0-100. Rendered visually (requirements.md 6.1), never as a bare number. */
  overallRating: number | null;
  inputsPresent: ApplicantAnalysisInputsPresent;
  modelName: string | null;
  promptVersion: string | null;
  createdAt: string;
};

export type ApplicantAnalysisSection = {
  key: keyof Pick<
    ApplicantAnalysis,
    | 'personalitySummary'
    | 'learningStyle'
    | 'academicStrengths'
    | 'growthAreas'
    | 'motivationAnalysis'
    | 'competitiveAdvantages'
    | 'suggestedPositioning'
  >;
  label: string;
  kind: 'prose' | 'list';
};

/** Iterated by the report UI so a new section is added in one place. */
export const APPLICANT_ANALYSIS_SECTIONS: readonly ApplicantAnalysisSection[] = [
  { key: 'personalitySummary', label: 'Personality Summary', kind: 'prose' },
  { key: 'learningStyle', label: 'Learning Style', kind: 'list' },
  { key: 'academicStrengths', label: 'Academic Strengths', kind: 'list' },
  { key: 'growthAreas', label: 'Growth Areas', kind: 'list' },
  { key: 'motivationAnalysis', label: 'Motivation Analysis', kind: 'prose' },
  { key: 'competitiveAdvantages', label: 'Competitive Advantages', kind: 'list' },
  { key: 'suggestedPositioning', label: 'Suggested Positioning', kind: 'prose' },
];

/**
 * A section is worth rendering only once it has content — requirements.md
 * 6.3: omit or soften a dependent section rather than show it empty.
 */
export function hasSectionContent(
  analysis: ApplicantAnalysis,
  section: ApplicantAnalysisSection,
): boolean {
  const value = analysis[section.key];
  return section.kind === 'list' ? Array.isArray(value) && value.length > 0 : Boolean(value);
}
