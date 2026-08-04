import type { NarrativeProfile } from './evaluation';

/**
 * `applicant_analyses` — the stored F1/F4 narrative.
 *
 * Append-only; the latest `createdAt` per `applicationId` is "the" analysis,
 * the same convention `cv_reviews` and `statement_analyses` use. This module is
 * pure: it knows the shape of the row and nothing about Supabase, the model
 * call, or React.
 *
 * ─── COLUMN NAMES AND SECTION NAMES DIFFER ON PURPOSE ────────────────────────
 *
 * The engine's sections are coreIdentity / drivingForce / signaturePattern /
 * personalPositioning. The columns are still personality_summary /
 * motivation_analysis / competitive_advantages / suggested_positioning, because
 * rows written before the engine existed hold real analyses for real students
 * and renaming would strand them. `narrativeFromRow` is the single place the
 * two vocabularies meet — see supabase-evaluation-engine.sql.
 */

export type ApplicantAnalysisInputsPresent = {
  personalSummary: boolean;
  achievements: boolean;
  evidence: boolean;
};

export type ApplicantAnalysisRecord = {
  id: string;
  applicationId: string;
  profileVersion: number;
  narrative: NarrativeProfile;
  inputsPresent: ApplicantAnalysisInputsPresent;
  modelName: string | null;
  promptVersion: string | null;
  createdAt: string;
};

const EMPTY_INPUTS: ApplicantAnalysisInputsPresent = {
  personalSummary: false,
  achievements: false,
  evidence: false,
};

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function prose(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * A stored row as the engine's narrative.
 *
 * Every field is read defensively. `emerging_themes` in particular is absent
 * from every row written before supabase-evaluation-engine.sql ran, and a
 * student whose analysis predates it must still get a page rather than a crash
 * — they get five sections and a prompt to refresh, which is the correct
 * outcome and is what `availablePortraitSections` already handles.
 */
export function narrativeFromRow(row: Record<string, unknown>): NarrativeProfile {
  return {
    coreIdentity: prose(row.personality_summary),
    learningStyle: strings(row.learning_style),
    academicStrengths: strings(row.academic_strengths),
    drivingForce: prose(row.motivation_analysis),
    signaturePattern: strings(row.competitive_advantages),
    emergingThemes: strings(row.emerging_themes),
    personalPositioning: prose(row.suggested_positioning),
    growthAreas: strings(row.growth_areas),
    overallRating: typeof row.overall_rating === 'number' ? row.overall_rating : null,
  };
}

export function applicantAnalysisFromRow(row: Record<string, unknown>): ApplicantAnalysisRecord {
  return {
    id: String(row.id ?? ''),
    applicationId: String(row.application_id ?? ''),
    profileVersion: typeof row.profile_version === 'number' ? row.profile_version : 0,
    narrative: narrativeFromRow(row),
    inputsPresent:
      row.inputs_present && typeof row.inputs_present === 'object'
        ? { ...EMPTY_INPUTS, ...(row.inputs_present as Partial<ApplicantAnalysisInputsPresent>) }
        : EMPTY_INPUTS,
    modelName: prose(row.model_name),
    promptVersion: prose(row.prompt_version),
    createdAt: String(row.created_at ?? ''),
  };
}
