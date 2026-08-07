import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ApplicationNav } from '@/components/application-nav';
import {
  courseUrlLabel,
  displayCourseName,
  displayUniversityName,
  isParsePending,
} from '@/features/apply/workspace-domain';
import { ApplicationBanner } from '@/features/apply/workspace-ui';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { getServerIdentity } from '@/server/auth/server-identity';
import { ApplicationWorkspaceShell } from './application-workspace-shell';
import { ApplicationWorkspaceV2 } from './application-workspace-v2';

type ProfileRow = {
  plus_status: boolean | null;
  academic_background: unknown;
  grades_summary: unknown;
};
type DocumentRow = { type: string };

function WorkspaceFallback() {
  return (
    <div
      className="grid min-h-[620px] animate-pulse gap-gb-5xl xl:grid-cols-[minmax(0,1fr)_320px]"
      aria-label="Loading application workspace"
      aria-busy="true"
    >
      <div className="rounded-gb-2xl border border-line bg-surface-muted" />
      <div className="rounded-gb-2xl border border-line bg-surface-muted" />
    </div>
  );
}

async function DeferredWorkspace({
  applicationId,
  workspacePromise,
  profilePromise,
  documentsPromise,
}: {
  applicationId: string;
  workspacePromise: ReturnType<typeof fetchApplicationWorkspace>;
  profilePromise: PromiseLike<ProfileRow | null>;
  documentsPromise: PromiseLike<DocumentRow[]>;
}) {
  try {
    const [workspace, profile, docs] = await Promise.all([
      workspacePromise,
      profilePromise,
      documentsPromise,
    ]);

    if (!workspace) {
      return (
        <section className="rounded-gb-2xl border border-line bg-surface-muted p-gb-4xl" role="alert">
          <h2 className="text-gb-lg font-semibold text-fg">Workspace could not be loaded</h2>
          <p className="mt-gb-sm text-gb-sm text-fg-tertiary">Please retry this application.</p>
          <Link className="mt-gb-lg inline-flex font-semibold text-brand" href={`/apply/${applicationId}`}>
            Try again
          </Link>
        </section>
      );
    }

    const essayTypes = ['statement_of_purpose', 'personal_statement', 'sop', 'statement'];
    const matchInputs = {
      cv: docs.some((document) => document.type === 'cv'),
      essay: docs.some((document) => essayTypes.includes(document.type)),
      academic: Boolean(profile?.academic_background || profile?.grades_summary),
    };

    return (
      <ApplicationWorkspaceV2
        workspace={{
          application: workspace.application,
          stages: workspace.stages,
          sources: workspace.sources,
          matchAnalysis: workspace.matchAnalysis,
        }}
        isPlus={Boolean(profile?.plus_status)}
        matchInputs={matchInputs}
      />
    );
  } catch (error) {
    console.error('apply: loading application workspace failed:', error);
    return (
      <section className="rounded-gb-2xl border border-line bg-surface-muted p-gb-4xl" role="alert">
        <h2 className="text-gb-lg font-semibold text-fg">Workspace could not be loaded</h2>
        <p className="mt-gb-sm text-gb-sm text-fg-tertiary">Please retry this application.</p>
        <Link className="mt-gb-lg inline-flex font-semibold text-brand" href={`/apply/${applicationId}`}>
          Try again
        </Link>
      </section>
    );
  }
}

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  const applicationShellPromise = supabase
    .from('course_applications')
    .select('id, university_name, course_name, course_url, parse_status, university:universities(logo_url)')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  const workspacePromise = fetchApplicationWorkspace(applicationId, user.id);
  const profilePromise = supabase
    .from('student_profiles')
    .select('plus_status, academic_background, grades_summary')
    .eq('user_id', user.id)
    .maybeSingle()
    .then(({ data }) => data as ProfileRow | null);
  const documentsPromise = supabase
    .from('uploaded_documents')
    .select('type')
    .eq('user_id', user.id)
    .then(({ data }) => (data ?? []) as DocumentRow[]);

  const { data: applicationShell, error: shellError } = await applicationShellPromise;
  if (shellError) throw shellError;
  if (!applicationShell) notFound();

  const university = Array.isArray(applicationShell.university)
    ? applicationShell.university[0]
    : applicationShell.university;
  const courseName = displayCourseName(applicationShell.course_name, applicationShell.parse_status);
  const universityName = displayUniversityName(applicationShell.university_name);
  const researching = isParsePending(applicationShell.parse_status);
  return (
    <ApplicationWorkspaceShell
      userName={user.name}
      userAvatarUrl={user.avatarUrl}
      nav={
        <Suspense
          fallback={
            <div
              className="min-h-24 animate-pulse rounded-gb-2xl border border-line bg-surface-muted"
              aria-label="Loading application navigation"
            />
          }
        >
          <ApplicationNav applicationId={applicationId} courseName={courseName} userId={user.id} />
        </Suspense>
      }
      banner={
        <ApplicationBanner
          {...(universityName ? { universityName } : {})}
          {...(courseName ? { courseName } : {})}
          urlLabel={courseUrlLabel(applicationShell.course_url)}
          logoUrl={university?.logo_url ?? null}
          researching={researching}
        />
      }
    >
      <Suspense fallback={<WorkspaceFallback />}>
        <DeferredWorkspace
          applicationId={applicationId}
          workspacePromise={workspacePromise}
          profilePromise={profilePromise}
          documentsPromise={documentsPromise}
        />
      </Suspense>
    </ApplicationWorkspaceShell>
  );
}
