import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cvActionHref,
  cvContentStatus,
  cvReviewStatus,
  cvStatus,
  hasExport,
  isAnalysisOutdated,
  isExportOutdated,
  isReviewOutdated,
  nextAction,
  statementActionHref,
  statementStatus,
  strategyStatus,
  targetProfileStatus,
  type CvLayoutKey,
  type CvReview,
  type CvSection,
  type CvTargetProfile,
  type StatementAnalysis,
  type StatementStrategy,
  type StrategyOverview,
  type StructuredCv,
  type WorkspaceStatus,
} from '../domain';

/**
 * The data-access layer for Feature 2's six tables.
 *
 * Rows arrive snake_cased from PostgREST and are mapped to the camelCase domain
 * types here, so nothing above this file deals in column names. The client
 * passed in is the RLS-scoped one from the route — this module never builds its
 * own, and never the service-role client: every table has an owner policy and
 * there is no operation here that needs to escape it.
 *
 * `user_id` is written explicitly on insert even though RLS would reject a
 * mismatched value. The WITH CHECK clause is the guard; passing it is what makes
 * the insert legal in the first place.
 */

// ── Row shapes ────────────────────────────────────────────────────────────

type StrategyRow = {
  id: string;
  user_id: string;
  application_id: string;
  status: WorkspaceStatus;
  created_at: string;
  updated_at: string;
};

type TargetProfileRow = {
  id: string;
  strategy_id: string;
  career_direction: string | null;
  university_positioning: string | null;
  education_philosophy: string | null;
  environment: string | null;
  programme_objectives: string | null;
  priority_capabilities: string | null;
  career_alignment: string | null;
  missing_information: string[] | null;
  sources_used: CvTargetProfile['sourcesUsed'] | null;
  version: number;
  generated_at: string | null;
  updated_at: string;
};

type StructuredCvRow = {
  id: string;
  strategy_id: string;
  source_document_id: string | null;
  sections: CvSection[] | null;
  selected_layout: CvLayoutKey | null;
  content_version: number;
  last_reviewed_version: number | null;
  last_exported_version: number | null;
  updated_at: string;
};

type CvReviewRow = {
  id: string;
  cv_id: string;
  target_profile_version: number;
  content_version: number;
  strengths: CvReview['strengths'] | null;
  missing_signals: CvReview['missingSignals'] | null;
  summary: string | null;
  sources_used: CvReview['sourcesUsed'] | null;
  model: string | null;
  created_at: string;
};

type StatementStrategyRow = {
  id: string;
  strategy_id: string;
  prompt: string | null;
  word_limit: number | null;
  brief: StatementStrategy['brief'] | null;
  source_urls: StatementStrategy['sourceUrls'] | null;
  updated_at: string;
};

type StatementAnalysisRow = {
  id: string;
  statement_id: number | null;
  strategy_id: string;
  content_version: number;
  overview: StatementAnalysis['overview'] | null;
  ideas_and_structure: StatementAnalysis['ideasAndStructure'] | null;
  opening: StatementAnalysis['opening'] | null;
  aacc: StatementAnalysis['aacc'] | null;
  readiness: StatementAnalysis['readiness'] | null;
  model: string | null;
  created_at: string;
};

// ── Mappers ───────────────────────────────────────────────────────────────

const EMPTY_BRIEF: StatementStrategy['brief'] = {
  mustDemonstrate: [],
  programmeInformation: [],
  evidenceToConsider: [],
  coveredByCv: [],
  missingInformation: [],
};

function toTargetProfile(row: TargetProfileRow): CvTargetProfile {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    careerDirection: row.career_direction,
    universityPositioning: row.university_positioning,
    educationPhilosophy: row.education_philosophy,
    environment: row.environment,
    programmeObjectives: row.programme_objectives,
    priorityCapabilities: row.priority_capabilities,
    careerAlignment: row.career_alignment,
    missingInformation: row.missing_information ?? [],
    sourcesUsed: row.sources_used ?? [],
    version: row.version,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

function toStructuredCv(row: StructuredCvRow): StructuredCv {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    sourceDocumentId: row.source_document_id,
    sections: row.sections ?? [],
    selectedLayout: row.selected_layout,
    contentVersion: row.content_version,
    lastReviewedVersion: row.last_reviewed_version,
    lastExportedVersion: row.last_exported_version,
    updatedAt: row.updated_at,
  };
}

function toCvReview(row: CvReviewRow): CvReview {
  return {
    id: row.id,
    cvId: row.cv_id,
    targetProfileVersion: row.target_profile_version,
    contentVersion: row.content_version,
    strengths: row.strengths ?? [],
    missingSignals: row.missing_signals ?? [],
    summary: row.summary ?? '',
    sourcesUsed: row.sources_used ?? [],
    model: row.model ?? '',
    createdAt: row.created_at,
  };
}

function toStatementStrategy(row: StatementStrategyRow): StatementStrategy {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    prompt: row.prompt,
    wordLimit: row.word_limit,
    brief: row.brief ?? EMPTY_BRIEF,
    sourceUrls: row.source_urls ?? [],
    updatedAt: row.updated_at,
  };
}

function toStatementAnalysis(row: StatementAnalysisRow): StatementAnalysis {
  return {
    id: row.id,
    statementId: row.statement_id,
    strategyId: row.strategy_id,
    contentVersion: row.content_version,
    overview: row.overview ?? {
      communicates: '',
      strongestQuality: '',
      mostImportantIssue: '',
      answersPrompt: 'unknown',
    },
    ideasAndStructure: row.ideas_and_structure ?? [],
    opening: row.opening ?? [],
    aacc: row.aacc ?? ({} as StatementAnalysis['aacc']),
    readiness: row.readiness ?? { checks: [], state: 'needs_attention' },
    model: row.model ?? '',
    createdAt: row.created_at,
  };
}

// ── Strategy root ─────────────────────────────────────────────────────────

/**
 * The strategy row for an application, creating it on first visit.
 *
 * `upsert` on the unique application_id rather than select-then-insert: two
 * tabs opening the workspace at once would otherwise race and one would get a
 * duplicate-key error on a page load that should just work.
 */
export async function getOrCreateStrategy(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<StrategyRow> {
  const { data: existing } = await supabase
    .from('application_strategies')
    .select('*')
    .eq('application_id', applicationId)
    .maybeSingle();

  if (existing) return existing as StrategyRow;

  const { data, error } = await supabase
    .from('application_strategies')
    .upsert(
      { user_id: userId, application_id: applicationId, status: 'not_started' },
      { onConflict: 'application_id' },
    )
    .select('*')
    .single();

  if (error) throw new Error(`Could not create the strategy: ${error.message}`);
  return data as StrategyRow;
}

export async function updateStrategyStatus(
  supabase: SupabaseClient,
  strategyId: string,
  status: WorkspaceStatus,
): Promise<void> {
  await supabase.from('application_strategies').update({ status }).eq('id', strategyId);
}

// ── Target profile ────────────────────────────────────────────────────────

export async function getTargetProfile(
  supabase: SupabaseClient,
  strategyId: string,
): Promise<CvTargetProfile | null> {
  const { data } = await supabase
    .from('cv_target_profiles')
    .select('*')
    .eq('strategy_id', strategyId)
    .maybeSingle();
  return data ? toTargetProfile(data as TargetProfileRow) : null;
}

/** The seven editable fields, camelCase in, snake_case out. */
export type TargetProfilePatch = Partial<
  Pick<
    CvTargetProfile,
    | 'careerDirection'
    | 'universityPositioning'
    | 'educationPhilosophy'
    | 'environment'
    | 'programmeObjectives'
    | 'priorityCapabilities'
    | 'careerAlignment'
    | 'missingInformation'
    | 'sourcesUsed'
  >
>;

const TARGET_PROFILE_COLUMNS: Record<keyof TargetProfilePatch, string> = {
  careerDirection: 'career_direction',
  universityPositioning: 'university_positioning',
  educationPhilosophy: 'education_philosophy',
  environment: 'environment',
  programmeObjectives: 'programme_objectives',
  priorityCapabilities: 'priority_capabilities',
  careerAlignment: 'career_alignment',
  missingInformation: 'missing_information',
  sourcesUsed: 'sources_used',
};

/**
 * Write target-profile fields, bumping `version`.
 *
 * The bump is unconditional on a patch reaching here, which is why the route
 * above it filters no-op edits: a version that moves when nothing changed would
 * invalidate a good CV review, the exact failure the version mechanism exists to
 * avoid.
 */
export async function upsertTargetProfile(
  supabase: SupabaseClient,
  args: {
    userId: string;
    strategyId: string;
    patch: TargetProfilePatch;
    /** Set when this write came from the generator. */
    generated?: boolean;
  },
): Promise<CvTargetProfile> {
  const { userId, strategyId, patch, generated } = args;

  const columns: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(TARGET_PROFILE_COLUMNS)) {
    const value = patch[key as keyof TargetProfilePatch];
    if (value !== undefined) columns[column] = value;
  }

  const existing = await getTargetProfile(supabase, strategyId);

  if (!existing) {
    const { data, error } = await supabase
      .from('cv_target_profiles')
      .insert({
        user_id: userId,
        strategy_id: strategyId,
        ...columns,
        version: 1,
        generated_at: generated ? new Date().toISOString() : null,
      })
      .select('*')
      .single();
    if (error) throw new Error(`Could not save the target profile: ${error.message}`);
    return toTargetProfile(data as TargetProfileRow);
  }

  const { data, error } = await supabase
    .from('cv_target_profiles')
    .update({
      ...columns,
      version: existing.version + 1,
      ...(generated ? { generated_at: new Date().toISOString() } : {}),
    })
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) throw new Error(`Could not save the target profile: ${error.message}`);
  return toTargetProfile(data as TargetProfileRow);
}

// ── Structured CV ─────────────────────────────────────────────────────────

export async function getStructuredCv(
  supabase: SupabaseClient,
  strategyId: string,
): Promise<StructuredCv | null> {
  const { data } = await supabase
    .from('structured_cvs')
    .select('*')
    .eq('strategy_id', strategyId)
    .maybeSingle();
  return data ? toStructuredCv(data as StructuredCvRow) : null;
}

/**
 * Write CV sections, bumping `content_version`.
 *
 * Sections are replaced wholesale, not merged. The editor owns the entire
 * document and PATCHes it back; merging would mean reconciling a deleted entry
 * against an array index, which is more moving parts than rewriting a structure
 * that is a few kilobytes at most. Same call, same reasoning, as the
 * replace-in-full achievements write in /api/reflection.
 */
export async function upsertStructuredCv(
  supabase: SupabaseClient,
  args: {
    userId: string;
    strategyId: string;
    sections?: CvSection[];
    selectedLayout?: CvLayoutKey | null;
    sourceDocumentId?: string | null;
    /** Set by the export route; does not bump the content version. */
    lastExportedVersion?: number;
    lastReviewedVersion?: number;
  },
): Promise<StructuredCv> {
  const { userId, strategyId, sections, selectedLayout, sourceDocumentId } = args;
  const existing = await getStructuredCv(supabase, strategyId);

  // Only a content change moves the version. Selecting a layout or recording an
  // export is not a content change, and treating it as one would make every
  // export invalidate the review that preceded it.
  const contentChanged = sections !== undefined;

  const columns: Record<string, unknown> = {};
  if (sections !== undefined) columns.sections = sections;
  if (selectedLayout !== undefined) columns.selected_layout = selectedLayout;
  if (sourceDocumentId !== undefined) columns.source_document_id = sourceDocumentId;
  if (args.lastExportedVersion !== undefined) {
    columns.last_exported_version = args.lastExportedVersion;
  }
  if (args.lastReviewedVersion !== undefined) {
    columns.last_reviewed_version = args.lastReviewedVersion;
  }

  if (!existing) {
    const { data, error } = await supabase
      .from('structured_cvs')
      .insert({ user_id: userId, strategy_id: strategyId, ...columns, content_version: 1 })
      .select('*')
      .single();
    if (error) throw new Error(`Could not save the CV: ${error.message}`);
    return toStructuredCv(data as StructuredCvRow);
  }

  const { data, error } = await supabase
    .from('structured_cvs')
    .update({
      ...columns,
      ...(contentChanged ? { content_version: existing.contentVersion + 1 } : {}),
    })
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error) throw new Error(`Could not save the CV: ${error.message}`);
  return toStructuredCv(data as StructuredCvRow);
}

// ── CV review ─────────────────────────────────────────────────────────────

export async function getLatestCvReview(
  supabase: SupabaseClient,
  cvId: string,
): Promise<CvReview | null> {
  const { data } = await supabase
    .from('cv_reviews')
    .select('*')
    .eq('cv_id', cvId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toCvReview(data as CvReviewRow) : null;
}

/** Append-only: reviews are never updated, and the latest row wins. */
export async function insertCvReview(
  supabase: SupabaseClient,
  args: {
    userId: string;
    cvId: string;
    targetProfileVersion: number;
    contentVersion: number;
    strengths: CvReview['strengths'];
    missingSignals: CvReview['missingSignals'];
    summary: string;
    sourcesUsed: CvReview['sourcesUsed'];
    model: string;
    promptVersion: string;
  },
): Promise<CvReview> {
  const { data, error } = await supabase
    .from('cv_reviews')
    .insert({
      user_id: args.userId,
      cv_id: args.cvId,
      target_profile_version: args.targetProfileVersion,
      content_version: args.contentVersion,
      strengths: args.strengths,
      missing_signals: args.missingSignals,
      summary: args.summary,
      sources_used: args.sourcesUsed,
      model: args.model,
      prompt_version: args.promptVersion,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Could not save the review: ${error.message}`);
  return toCvReview(data as CvReviewRow);
}

// ── Statement ─────────────────────────────────────────────────────────────

export async function getStatementStrategy(
  supabase: SupabaseClient,
  strategyId: string,
): Promise<StatementStrategy | null> {
  const { data } = await supabase
    .from('statement_strategies')
    .select('*')
    .eq('strategy_id', strategyId)
    .maybeSingle();
  return data ? toStatementStrategy(data as StatementStrategyRow) : null;
}

export async function upsertStatementStrategy(
  supabase: SupabaseClient,
  args: {
    userId: string;
    strategyId: string;
    prompt?: string | null;
    wordLimit?: number | null;
    brief?: StatementStrategy['brief'];
    sourceUrls?: StatementStrategy['sourceUrls'];
  },
): Promise<StatementStrategy> {
  const columns: Record<string, unknown> = {
    user_id: args.userId,
    strategy_id: args.strategyId,
  };
  if (args.prompt !== undefined) columns.prompt = args.prompt;
  if (args.wordLimit !== undefined) columns.word_limit = args.wordLimit;
  if (args.brief !== undefined) columns.brief = args.brief;
  if (args.sourceUrls !== undefined) columns.source_urls = args.sourceUrls;

  const { data, error } = await supabase
    .from('statement_strategies')
    .upsert(columns, { onConflict: 'strategy_id' })
    .select('*')
    .single();

  if (error) throw new Error(`Could not save the statement brief: ${error.message}`);
  return toStatementStrategy(data as StatementStrategyRow);
}

export async function getLatestStatementAnalysis(
  supabase: SupabaseClient,
  strategyId: string,
): Promise<StatementAnalysis | null> {
  const { data } = await supabase
    .from('statement_analyses')
    .select('*')
    .eq('strategy_id', strategyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toStatementAnalysis(data as StatementAnalysisRow) : null;
}

/** Append-only, and all five sections in one row so they cannot disagree. */
export async function insertStatementAnalysis(
  supabase: SupabaseClient,
  args: {
    userId: string;
    strategyId: string;
    statementId: number | null;
    contentVersion: number;
    overview: StatementAnalysis['overview'];
    ideasAndStructure: StatementAnalysis['ideasAndStructure'];
    opening: StatementAnalysis['opening'];
    aacc: StatementAnalysis['aacc'];
    readiness: StatementAnalysis['readiness'];
    model: string;
    promptVersion: string;
  },
): Promise<StatementAnalysis> {
  const { data, error } = await supabase
    .from('statement_analyses')
    .insert({
      user_id: args.userId,
      strategy_id: args.strategyId,
      statement_id: args.statementId,
      content_version: args.contentVersion,
      overview: args.overview,
      ideas_and_structure: args.ideasAndStructure,
      opening: args.opening,
      aacc: args.aacc,
      readiness: args.readiness,
      model: args.model,
      prompt_version: args.promptVersion,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Could not save the analysis: ${error.message}`);
  return toStatementAnalysis(data as StatementAnalysisRow);
}

/** The statement draft, from the table that already owns it. */
export async function getStatementDraft(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<{ id: number; content: string; version: number; updatedAt: string } | null> {
  const { data } = await supabase
    .from('personal_statements')
    .select('id, content, version, updated_at')
    .eq('application_id', applicationId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as number,
    content: (data.content as string) ?? '',
    version: (data.version as number) ?? 1,
    updatedAt: data.updated_at as string,
  };
}

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

// ── Overview ──────────────────────────────────────────────────────────────

/**
 * Everything the overview page renders, in one call.
 *
 * Assembled here rather than in the page so the API route and the server
 * component return the same shape, and so the status derivation is applied once
 * to one set of reads. Every field the page displays is nullable: the product
 * rule is that missing information produces an actionable incomplete state, so a
 * course with no deadline is a value the page omits, not an error.
 */
export async function getStrategyOverview(
  supabase: SupabaseClient,
  args: {
    userId: string;
    applicationId: string;
    application: {
      university_name?: string | null;
      course_name?: string | null;
      degree_level?: string | null;
      deadline?: string | null;
      status?: string | null;
    };
    universityLogoUrl?: string | null;
  },
): Promise<StrategyOverview> {
  const strategy = await getOrCreateStrategy(supabase, args.userId, args.applicationId);

  const [targetProfile, cv, statementStrategy, analysis, draft] = await Promise.all([
    getTargetProfile(supabase, strategy.id),
    getStructuredCv(supabase, strategy.id),
    getStatementStrategy(supabase, strategy.id),
    getLatestStatementAnalysis(supabase, strategy.id),
    getStatementDraft(supabase, args.applicationId),
  ]);

  const review = cv ? await getLatestCvReview(supabase, cv.id) : null;

  const reviewOutdated = isReviewOutdated(review, cv, targetProfile);
  const exportOutdated = cv ? isExportOutdated(cv) : false;
  const cvHasExport = cv ? hasExport(cv) : false;
  const analysisOutdated = isAnalysisOutdated(analysis, draft?.version ?? null);

  const cvInputs = {
    targetProfile: targetProfile
      ? {
          generatedAt: targetProfile.generatedAt,
          filledFieldCount: filledTargetProfileFields(targetProfile),
        }
      : null,
    cv: cv
      ? {
          sectionCount: cv.sections.length,
          entryCount: cv.sections.reduce((n, s) => n + s.entries.length, 0),
          selectedLayout: cv.selectedLayout,
          hasExport: cvHasExport,
          exportOutdated,
        }
      : null,
    review: review
      ? {
          criticalCount: review.missingSignals.filter((s) => s.critical).length,
          outdated: reviewOutdated,
        }
      : null,
  };

  const wordCount = countWords(draft?.content);

  const statementInputs = {
    wordCount,
    analysis: analysis
      ? {
          outdated: analysisOutdated,
          readiness: analysis.readiness.state,
          // Resolution is tracked client-side today; a finding is unresolved
          // until the student acts on it, so a fresh analysis with problems
          // counts them all.
          unresolvedCriticalCount: [...analysis.ideasAndStructure, ...analysis.opening].filter(
            (f) => f.severity === 'problem',
          ).length,
        }
      : null,
  };

  const cvValue = cvStatus(cvInputs);
  const statementValue = statementStatus(statementInputs);

  return {
    strategyId: strategy.id,
    applicationId: args.applicationId,
    status: strategyStatus(cvValue, statementValue),
    actions: {
      next: nextAction({
        applicationId: args.applicationId,
        cv: cvInputs,
        statement: statementInputs,
        cvStatusValue: cvValue,
        statementStatusValue: statementValue,
      }),
      cvHref: cvActionHref(args.applicationId, cvInputs),
      statementHref: statementActionHref(args.applicationId, statementInputs),
    },
    application: {
      universityName: args.application.university_name ?? null,
      universityLogoUrl: args.universityLogoUrl ?? null,
      courseName: args.application.course_name ?? null,
      degreeLevel: args.application.degree_level ?? null,
      deadline: args.application.deadline ?? null,
      applicationStatus: args.application.status ?? null,
    },
    cv: {
      status: cvValue,
      updatedAt: cv?.updatedAt ?? null,
      targetProfileStatus: targetProfileStatus(cvInputs.targetProfile),
      contentStatus: cvContentStatus(cvInputs.cv),
      reviewStatus: cvReviewStatus(cvInputs.review),
      selectedLayout: cv?.selectedLayout ?? null,
      exportStatus: !cvHasExport ? 'none' : exportOutdated ? 'outdated' : 'ready',
      reviewOutdated,
    },
    statement: {
      status: statementValue,
      wordCount,
      wordLimit: statementStrategy?.wordLimit ?? null,
      lastSavedAt: draft?.updatedAt ?? null,
      lastAnalyzedAt: analysis?.createdAt ?? null,
      ideasStatus: sectionStatus(analysis?.ideasAndStructure.length, analysisOutdated),
      openingStatus: sectionStatus(analysis?.opening.length, analysisOutdated),
      aaccStatus: sectionStatus(
        analysis ? Object.keys(analysis.aacc).length : undefined,
        analysisOutdated,
      ),
      readinessStatus: !analysis
        ? 'not_started'
        : analysisOutdated
          ? 'needs_attention'
          : analysis.readiness.state === 'ready'
            ? 'ready_for_audit'
            : 'needs_attention',
      analysisOutdated,
    },
  };
}

function filledTargetProfileFields(tp: CvTargetProfile): number {
  return [
    tp.careerDirection,
    tp.universityPositioning,
    tp.educationPhilosophy,
    tp.environment,
    tp.programmeObjectives,
    tp.priorityCapabilities,
    tp.careerAlignment,
  ].filter((v) => v != null && v.trim().length > 0).length;
}

/** An analysis section is "done" when it produced findings and is still current. */
function sectionStatus(count: number | undefined, outdated: boolean): WorkspaceStatus {
  if (count === undefined) return 'not_started';
  if (outdated) return 'needs_attention';
  if (count === 0) return 'in_progress';
  return 'ready_for_audit';
}
