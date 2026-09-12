import { isAdmin } from '@/server/auth/auth-helpers';
import { createAdminClient } from '@/server/db/admin';
import { createClient } from '@/server/db/server';

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
  output: unknown;
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
    output: null,
  };
}

function availableNode(
  kind: ReviewKind,
  title: string,
  row: Record<string, unknown>,
  sources: Source[],
  output: unknown,
): AdminAiReportReviewNode {
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
    output,
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
      .select('id,report_v2,input_hash,prompt_version,model_name,created_at,source_personal_report_version_id,source_match_analysis_id')
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
          { label: 'Personal Report version', value: text(matchingRow.source_personal_report_version_id) },
          { label: 'Candidate snapshot', value: text(matchingRow.confirmed_snapshot_id) },
          { label: 'Target programme profile', value: text(matchingRow.target_profile_version_id) },
        ], matchingRow.report_v2)
      : unavailableNode('matching', 'Matching Report', [
          { label: 'Personal Report version', value: null },
          { label: 'Candidate snapshot', value: null },
          { label: 'Target programme profile', value: null },
        ]),
    strategyRow
      ? availableNode('strategy', 'Strategy Report', strategyRow, [
          { label: 'Personal Report version', value: text(strategyRow.source_personal_report_version_id) },
          { label: 'Matching Report', value: text(strategyRow.source_match_analysis_id) },
        ], strategyRow.report_v2)
      : unavailableNode('strategy', 'Strategy Report', [
          { label: 'Personal Report version', value: null },
          { label: 'Matching Report', value: null },
        ]),
  ];

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
