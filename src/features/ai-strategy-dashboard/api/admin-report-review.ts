import { isAdmin } from '@/server/auth/auth-helpers';
import { createAdminClient } from '@/server/db/admin';
import { createClient } from '@/server/db/server';
import { personalReportV2Schema } from '@/features/apply/domain/personal-report';
import { matchingReportV2Schema, matchingReportV3Schema } from '@/lib/ai/matching/domain';
import { strategyReportV3FromRow } from '@/lib/ai/strategy-v3/domain';

const REVIEW_LIMIT = 100;
const SOURCE_LIMIT = 300;

type AdminFailure = { ok: false; error: string; status: 401 | 403 | 404 | 500 };

type ReviewKind = 'personal' | 'matching' | 'strategy';

type ReportActivity = {
  applicationId: string;
  generatedAt: string;
  kind: ReviewKind;
};

type Source = { label: string; value: string | null };

export type AdminAiReportOutputFormat =
  | 'personal_report_v2'
  | 'matching_report_v3'
  | 'matching_report_v2'
  | 'strategy_report_v3'
  | 'unknown';

export type AdminAiReportInputSection = {
  label: string;
  persisted: boolean;
  value: unknown;
};

export type AdminAiReportReviewListItem = {
  applicationId: string;
  courseName: string | null;
  universityName: string | null;
  subject: string | null;
  lastGeneratedAt: string;
  availableReports: ReviewKind[];
};

export type AdminAiReportReviewNode = {
  id: string;
  kind: ReviewKind;
  title: string;
  available: boolean;
  generatedAt: string | null;
  modelName: string | null;
  promptVersion: string | null;
  inputHash: string | null;
  sources: Source[];
  outputFormat: AdminAiReportOutputFormat;
  output: unknown;
  rawOutput: unknown;
  inputs: { sections: AdminAiReportInputSection[] };
  metadata: Record<string, unknown>;
};

export type AdminAiReportReview = {
  application: AdminAiReportReviewListItem;
  nodes: AdminAiReportReviewNode[];
};

export type AdminAiReportReviewListResult =
  | { ok: true; items: AdminAiReportReviewListItem[] }
  | AdminFailure;

export type AdminAiReportReviewResult =
  | { ok: true; review: AdminAiReportReview }
  | AdminFailure;

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

export function detectAdminAiReportOutput(kind: ReviewKind, value: unknown): {
  format: AdminAiReportOutputFormat;
  output: unknown;
} {
  if (kind === 'personal') {
    const parsed = personalReportV2Schema.safeParse(value);
    return parsed.success
      ? { format: 'personal_report_v2', output: parsed.data }
      : { format: 'unknown', output: value };
  }
  if (kind === 'matching') {
    const v3 = matchingReportV3Schema.safeParse(value);
    if (v3.success) return { format: 'matching_report_v3', output: v3.data };
    const v2 = matchingReportV2Schema.safeParse(value);
    return v2.success
      ? { format: 'matching_report_v2', output: v2.data }
      : { format: 'unknown', output: value };
  }
  const v3 = strategyReportV3FromRow({ report_v2: value });
  return v3 ? { format: 'strategy_report_v3', output: v3 } : { format: 'unknown', output: value };
}

async function authorizeAdmin(): Promise<{ ok: true } | AdminFailure> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false, error: 'Sign in required', status: 401 };
  if (!(await isAdmin(user.id))) return { ok: false, error: 'Forbidden', status: 403 };
  return { ok: true };
}

function mergeActivity(
  activity: Map<string, { lastGeneratedAt: string; availableReports: Set<ReviewKind> }>,
  row: ReportActivity,
) {
  const current = activity.get(row.applicationId);
  if (!current) {
    activity.set(row.applicationId, {
      lastGeneratedAt: row.generatedAt,
      availableReports: new Set([row.kind]),
    });
    return;
  }
  current.availableReports.add(row.kind);
  if (row.generatedAt > current.lastGeneratedAt) current.lastGeneratedAt = row.generatedAt;
}

/**
 * The list intentionally carries only report availability and lineage metadata.
 * The selected report's JSON is loaded separately so one admin page never
 * serializes every student's report content to the browser.
 */
export async function listAdminAiReportReview(): Promise<AdminAiReportReviewListResult> {
  const authorization = await authorizeAdmin();
  if (!authorization.ok) return authorization;

  const admin = createAdminClient();
  const [personal, matching, strategy] = await Promise.all([
    admin.from('student_personal_report_versions')
      .select('application_id,generated_at,created_at')
      .not('application_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(SOURCE_LIMIT),
    admin.from('application_match_analyses')
      .select('application_id,created_at')
      .eq('analysis_status', 'complete')
      .order('created_at', { ascending: false })
      .limit(SOURCE_LIMIT),
    admin.from('application_strategy_recommendations')
      .select('application_id,created_at')
      .order('created_at', { ascending: false })
      .limit(SOURCE_LIMIT),
  ]);

  if (personal.error || matching.error || strategy.error) {
    console.error('Admin AI report review list failed', {
      personal: personal.error?.message,
      matching: matching.error?.message,
      strategy: strategy.error?.message,
    });
    return { ok: false, error: 'Could not load AI report activity', status: 500 };
  }

  const activity = new Map<string, { lastGeneratedAt: string; availableReports: Set<ReviewKind> }>();
  for (const row of asRows(personal.data)) {
    const applicationId = text(row.application_id);
    const generatedAt = text(row.generated_at) ?? text(row.created_at);
    if (applicationId && generatedAt) mergeActivity(activity, { applicationId, generatedAt, kind: 'personal' });
  }
  for (const row of asRows(matching.data)) {
    const applicationId = text(row.application_id);
    const generatedAt = text(row.created_at);
    if (applicationId && generatedAt) mergeActivity(activity, { applicationId, generatedAt, kind: 'matching' });
  }
  for (const row of asRows(strategy.data)) {
    const applicationId = text(row.application_id);
    const generatedAt = text(row.created_at);
    if (applicationId && generatedAt) mergeActivity(activity, { applicationId, generatedAt, kind: 'strategy' });
  }

  const candidates = [...activity.entries()]
    .sort(([, a], [, b]) => b.lastGeneratedAt.localeCompare(a.lastGeneratedAt))
    .slice(0, REVIEW_LIMIT);
  if (candidates.length === 0) return { ok: true, items: [] };

  const { data: applications, error } = await admin
    .from('course_applications')
    .select('id,course_name,university_name,subject')
    .in('id', candidates.map(([applicationId]) => applicationId));
  if (error) {
    console.error('Admin AI report application query failed:', error.message);
    return { ok: false, error: 'Could not load report applications', status: 500 };
  }

  const applicationById = new Map(
    asRows(applications).map((application) => [text(application.id), application]),
  );
  return {
    ok: true,
    items: candidates.flatMap(([applicationId, summary]) => {
      const application = applicationById.get(applicationId);
      if (!application) return [];
      return [{
        applicationId,
        courseName: text(application.course_name),
        universityName: text(application.university_name),
        subject: text(application.subject),
        lastGeneratedAt: summary.lastGeneratedAt,
        availableReports: [...summary.availableReports],
      }];
    }),
  };
}

function unavailableNode(kind: ReviewKind, title: string, sources: Source[]): AdminAiReportReviewNode {
  return {
    id: kind,
    kind,
    title,
    available: false,
    generatedAt: null,
    modelName: null,
    promptVersion: null,
    inputHash: null,
    sources,
    outputFormat: 'unknown',
    output: null,
    rawOutput: null,
    inputs: { sections: [] },
    metadata: {},
  };
}

function metadataFromRow(row: Record<string, unknown>, output: unknown): Record<string, unknown> {
  const reportMetadata = output && typeof output === 'object' && 'metadata' in output
    ? (output as { metadata?: unknown }).metadata
    : null;
  const metadata = reportMetadata && typeof reportMetadata === 'object'
    ? { ...(reportMetadata as Record<string, unknown>) }
    : {};
  for (const [key, value] of [
    ['reportContractVersion', row.report_contract_version],
    ['engineVersion', row.matching_engine_version ?? row.f5_engine_version],
    ['generationMetadata', row.generation_metadata],
  ] as const) {
    if (value !== null && value !== undefined && metadata[key] === undefined) metadata[key] = value;
  }
  return metadata;
}

async function exactRow(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  id: string | null,
  select: string,
): Promise<Record<string, unknown> | null> {
  if (!id) return null;
  const result = await admin.from(table).select(select).eq('id', id).maybeSingle();
  if (result.error) {
    console.warn(`Admin AI report review input read failed for ${table}`, result.error.message);
    return null;
  }
  return (result.data as Record<string, unknown> | null) ?? null;
}

async function inputSections(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  kind: ReviewKind,
  row: Record<string, unknown> | null,
  output: unknown,
): Promise<{ sections: AdminAiReportInputSection[] }> {
  if (!row) return { sections: [] };
  const sections: AdminAiReportInputSection[] = [];
  const add = (label: string, value: unknown, persisted = true) => sections.push({ label, value, persisted });
  const snapshotId = text(row.confirmed_snapshot_id) ?? text((output as { metadata?: { confirmedSnapshotId?: unknown } } | null)?.metadata?.confirmedSnapshotId);
  const sourceAnalysisId = text(row.source_analysis_version_id) ?? text(row.source_analysis_id) ?? text((output as { metadata?: { sourceAnalysisVersionId?: unknown } } | null)?.metadata?.sourceAnalysisVersionId);
  const snapshot = await exactRow(admin, 'confirmed_candidate_snapshots', snapshotId, 'id,payload,schema_version,confirmed_at');
  const analysis = await exactRow(admin, 'application_profile_analysis_versions', sourceAnalysisId, 'id,structured_outputs,evidence_bank,module_versions,generation_metadata,input_hash,created_at,confirmed_snapshot_id');
  if (kind === 'personal') {
    add('Confirmed candidate snapshot', snapshot ? { payload: snapshot.payload, schemaVersion: snapshot.schema_version, confirmedAt: snapshot.confirmed_at } : null, Boolean(snapshot));
    add('Profile analysis inputs', analysis ? { structuredOutputs: analysis.structured_outputs, evidenceBank: analysis.evidence_bank, moduleVersions: analysis.module_versions, generationMetadata: analysis.generation_metadata } : null, Boolean(analysis));
    add('Structured evaluation diagnostics', row.structured_evaluation ?? null, row.structured_evaluation != null);
    return { sections };
  }
  const personalId = text(row.source_personal_report_version_id) ?? text((output as { metadata?: { personalReportVersionId?: unknown } } | null)?.metadata?.personalReportVersionId);
  const personal = await exactRow(admin, 'student_personal_report_versions', personalId, 'id,report_v2,structured_evaluation,confirmed_snapshot_id,source_analysis_version_id,input_hash,created_at');
  if (kind === 'matching') {
    add('Personal Report version', personal ? { id: personal.id, report: personal.report_v2, evaluation: personal.structured_evaluation } : null, Boolean(personal));
    add('Confirmed candidate snapshot', snapshot ? { payload: snapshot.payload, schemaVersion: snapshot.schema_version, confirmedAt: snapshot.confirmed_at } : null, Boolean(snapshot));
    add('Profile analysis inputs', analysis ? { structuredOutputs: analysis.structured_outputs, evidenceBank: analysis.evidence_bank, moduleVersions: analysis.module_versions, generationMetadata: analysis.generation_metadata } : null, Boolean(analysis));
    const targetId = text(row.target_profile_version_id) ?? text((output as { metadata?: { targetProfileVersionId?: unknown } } | null)?.metadata?.targetProfileVersionId);
    const target = await exactRow(admin, 'programme_target_profile_versions', targetId, 'id,profile,schema_version,extraction_prompt_version,created_at');
    add('Target programme profile', target ? { id: target.id, profile: target.profile, schemaVersion: target.schema_version, createdAt: target.created_at } : null, Boolean(target));
    return { sections };
  }
  add('Personal Report source', personal ? { id: personal.id, report: personal.report_v2 } : null, Boolean(personal));
  const matchingId = text(row.source_match_analysis_id);
  const matching = await exactRow(admin, 'application_match_analyses', matchingId, 'id,report_v2,created_at,input_hash,report_contract_version,matching_engine_version');
  add('Matching Report source', matching ? { id: matching.id, report: matching.report_v2, createdAt: matching.created_at } : null, Boolean(matching));
  add('Confirmed candidate snapshot', snapshot ? { payload: snapshot.payload, schemaVersion: snapshot.schema_version, confirmedAt: snapshot.confirmed_at } : null, Boolean(snapshot));
  add('Profile analysis inputs', analysis ? { structuredOutputs: analysis.structured_outputs, evidenceBank: analysis.evidence_bank, moduleVersions: analysis.module_versions } : null, Boolean(analysis));
  const metadata = output && typeof output === 'object' && 'metadata' in output ? (output as { metadata?: Record<string, unknown> }).metadata : null;
  if (metadata && typeof metadata === 'object') {
    const targetId = text(metadata.targetProfileVersionId);
    const target = await exactRow(admin, 'programme_target_profile_versions', targetId, 'id,profile,schema_version,extraction_prompt_version,created_at');
    add('Target programme profile', target ? { id: target.id, profile: target.profile, schemaVersion: target.schema_version, createdAt: target.created_at } : null, Boolean(target));
    const scholarshipId = text(metadata.selectedScholarshipVersionId);
    if (scholarshipId) add('Selected scholarship version', { id: scholarshipId }, false);
  }
  if (sections.length === 0) add('Exact historical input', null, false);
  void applicationId;
  return { sections };
}

function availableNode(
  kind: ReviewKind,
  title: string,
  row: Record<string, unknown>,
  sources: Source[],
  output: unknown,
): AdminAiReportReviewNode {
  const parsed = detectAdminAiReportOutput(kind, output);
  return {
    id: text(row.id) ?? kind,
    kind,
    title,
    available: true,
    generatedAt: text(row.generated_at) ?? text(row.created_at),
    modelName: text(row.model_name),
    promptVersion: text(row.prompt_version),
    inputHash: text(row.input_hash),
    sources,
    outputFormat: parsed.format,
    output: parsed.output,
    rawOutput: output,
    inputs: { sections: [] },
    metadata: metadataFromRow(row, parsed.output),
  };
}

export async function getAdminAiReportReview(applicationId: string): Promise<AdminAiReportReviewResult> {
  const authorization = await authorizeAdmin();
  if (!authorization.ok) return authorization;

  const admin = createAdminClient();
  const { data: application, error: applicationError } = await admin
    .from('course_applications')
    .select('id,course_name,university_name,subject')
    .eq('id', applicationId)
    .maybeSingle();
  if (applicationError) {
    console.error('Admin AI report application detail query failed:', applicationError.message);
    return { ok: false, error: 'Could not load report application', status: 500 };
  }
  if (!application) return { ok: false, error: 'Application not found', status: 404 };

  const [personal, matching, strategy] = await Promise.all([
    admin.from('student_personal_report_versions')
      .select('id,report_v2,structured_evaluation,input_hash,prompt_version,model_name,generated_at,created_at,confirmed_snapshot_id,source_analysis_version_id')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('application_match_analyses')
      .select('id,report_v2,input_hash,prompt_version,model_name,created_at,confirmed_snapshot_id,source_personal_report_version_id,target_profile_version_id')
      .eq('application_id', applicationId)
      .eq('analysis_status', 'complete')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('application_strategy_recommendations')
      .select('id,report_v2,input_hash,prompt_version,model_name,created_at,source_analysis_id,source_personal_report_version_id,source_match_analysis_id')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (personal.error || matching.error || strategy.error) {
    console.error('Admin AI report detail query failed', {
      personal: personal.error?.message,
      matching: matching.error?.message,
      strategy: strategy.error?.message,
    });
    return { ok: false, error: 'Could not load AI report details', status: 500 };
  }

  const personalRow = personal.data as Record<string, unknown> | null;
  const matchingRow = matching.data as Record<string, unknown> | null;
  const strategyRow = strategy.data as Record<string, unknown> | null;
  const outputMetadata = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && 'metadata' in value
    ? ((value as { metadata?: unknown }).metadata && typeof (value as { metadata?: unknown }).metadata === 'object' ? (value as { metadata: Record<string, unknown> }).metadata : {})
    : {};
  const nodes: AdminAiReportReviewNode[] = [
    personalRow
      ? availableNode('personal', 'Personal Report', personalRow, [
          { label: 'Candidate snapshot', value: text(personalRow.confirmed_snapshot_id) },
          { label: 'Profile analysis', value: text(personalRow.source_analysis_version_id) },
        ], { report: personalRow.report_v2, evaluation: personalRow.structured_evaluation })
      : unavailableNode('personal', 'Personal Report', [
          { label: 'Candidate snapshot', value: null },
          { label: 'Profile analysis', value: null },
        ]),
    matchingRow
      ? availableNode('matching', 'Matching Report', matchingRow, [
          { label: 'Personal Report version', value: text(matchingRow.source_personal_report_version_id) ?? text(outputMetadata(matchingRow.report_v2).personalReportVersionId) },
          { label: 'Candidate snapshot', value: text(matchingRow.confirmed_snapshot_id) ?? text(outputMetadata(matchingRow.report_v2).confirmedSnapshotId) },
          { label: 'Target programme profile', value: text(matchingRow.target_profile_version_id) ?? text(outputMetadata(matchingRow.report_v2).targetProfileVersionId) },
        ], matchingRow.report_v2)
      : unavailableNode('matching', 'Matching Report', [
          { label: 'Personal Report version', value: null },
          { label: 'Candidate snapshot', value: null },
          { label: 'Target programme profile', value: null },
        ]),
    strategyRow
      ? availableNode('strategy', 'Strategy Report', strategyRow, [
          { label: 'Personal Report version', value: text(strategyRow.source_personal_report_version_id) ?? text(outputMetadata(strategyRow.report_v2).personalReportVersionId) },
          { label: 'Matching Report', value: text(strategyRow.source_match_analysis_id) ?? text(outputMetadata(strategyRow.report_v2).matchingReportId) },
          { label: 'Candidate snapshot', value: text(outputMetadata(strategyRow.report_v2).confirmedSnapshotId) },
          { label: 'Target programme profile', value: text(outputMetadata(strategyRow.report_v2).targetProfileVersionId) },
        ], strategyRow.report_v2)
      : unavailableNode('strategy', 'Strategy Report', [
          { label: 'Personal Report version', value: null },
          { label: 'Matching Report', value: null },
        ]),
  ];

  await Promise.all(nodes.map(async (node) => {
    if (!node.available) return;
    const row = node.kind === 'personal' ? personalRow : node.kind === 'matching' ? matchingRow : strategyRow;
    node.inputs = await inputSections(admin, applicationId, node.kind, row, node.output);
    if (node.kind === 'personal' && personalRow?.structured_evaluation != null) {
      node.metadata = { ...node.metadata, structuredEvaluation: personalRow.structured_evaluation };
    }
  }));

  return {
    ok: true,
    review: {
      application: {
        applicationId,
        courseName: text(application.course_name),
        universityName: text(application.university_name),
        subject: text(application.subject),
        lastGeneratedAt: nodes.reduce((latest, node) => node.generatedAt && node.generatedAt > latest ? node.generatedAt : latest, ''),
        availableReports: nodes.filter((node) => node.available).map((node) => node.kind),
      },
      nodes,
    },
  };
}
