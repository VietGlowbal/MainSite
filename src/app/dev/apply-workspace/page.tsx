import { notFound } from 'next/navigation';
import type {
  ApplicationStage,
  ApplicationTask,
  ApplicationWorkspaceView,
  TaskStatus,
} from '@/lib/apply-types';
import { ApplicationWorkspaceV2 } from '@/app/apply/[applicationId]/application-workspace-v2';

/**
 * /dev/apply-workspace — design preview for /apply/[applicationId].
 *
 * Same reason /dev/saved-list exists: the real route is behind the auth gate,
 * and reviewing its interesting states means holding a signed-in account whose
 * applications happen to be in those states. Two of the three below are states
 * you cannot conjure on demand at all — a parse that is still running, and one
 * that failed.
 *
 * Everything rendered is the real component. Only the data is fabricated, and
 * it is written to be obviously fabricated: CLAUDE.md is explicit that demo
 * data must not be mistakable for a real student's, so the university is
 * invented rather than borrowed from the directory.
 *
 * ?state=pending | researching | failed | active — defaults to active.
 */

const DEMO_UNIVERSITY = 'Demo Institute of Technology';

function task(
  id: string,
  title: string,
  status: TaskStatus,
  extra: Partial<ApplicationTask> = {},
): ApplicationTask {
  return {
    id,
    applicationId: 'demo',
    title,
    taskType: 'general',
    status,
    priority: 'medium',
    confidence: 0.9,
    sortOrder: 0,
    createdBy: 'ai',
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

function stage(
  id: string,
  name: string,
  orderNum: number,
  status: ApplicationStage['status'],
  tasks: ApplicationTask[],
): ApplicationStage {
  return {
    id,
    applicationId: 'demo',
    name,
    slug: id,
    orderNum,
    status,
    isRequired: true,
    aiGenerated: true,
    confidence: 0.9,
    createdAt: '',
    updatedAt: '',
    tasks,
  };
}

/** The five-stage template the parse worker writes. */
const STAGES: ApplicationStage[] = [
  stage('research', 'Research', 1, 'completed', [
    task('r1', 'Read the course structure and module list', 'completed'),
    task('r2', 'Check where graduates of this course go', 'completed'),
  ]),
  stage('check-eligibility', 'Check eligibility', 2, 'completed', [
    task('e1', 'Confirm your grades meet the published entry requirements', 'completed'),
    task('e2', 'Check the English language requirement', 'completed'),
  ]),
  stage('prepare-documents', 'Prepare documents', 3, 'in_progress', [
    task('d1', 'Request two academic references', 'completed'),
    task('d2', 'Draft your personal statement', 'in_progress'),
    task('d3', 'Get your transcript translated and certified', 'not_started'),
    task('d4', 'Sit an admissions test', 'not_applicable'),
  ]),
  stage('improve-application', 'Improve application', 4, 'not_started', [
    task('i1', 'Ask a mentor to review your statement', 'not_started'),
  ]),
  stage('submit', 'Submit', 5, 'not_started', [
    task('s1', 'Pay the application fee', 'not_started'),
    task('s2', 'Submit through the university portal', 'not_started'),
  ]),
];

function view(state: 'pending' | 'researching' | 'failed' | 'active'): ApplicationWorkspaceView {
  const base = {
    id: 'demo',
    userId: 'demo',
    universityName: DEMO_UNIVERSITY,
    courseUrl: 'https://example.edu/courses/demo',
    status: 'preparing' as const,
    progressPercentage: 0,
    importStatus: 'complete',
    createdAt: '',
    updatedAt: '',
  };

  if (state === 'pending') {
    return {
      // Exactly what a freshly pasted URL looks like: BOTH placeholders the
      // insert writes, and no checklist at all. The university placeholder
      // matters — it was rendering as the page's <h1>.
      application: {
        ...base,
        universityName: 'Unknown University',
        courseName: 'Loading course details...',
        parseStatus: 'pending',
      },
      stages: [],
      requirements: [],
      sources: [],
      recommendations: [],
      metrics: { progress: 0, requirementsMet: 0, requirementsTotal: 0 },
    };
  }

  if (state === 'researching') {
    // The half-parsed middle: stages written, tasks not yet distributed into
    // all of them. This is the state in the report — a real application whose
    // first stage showed a padlock over "No tasks yet".
    return {
      application: {
        ...base,
        universityName: 'Unknown University',
        courseName: 'Loading course details...',
        parseStatus: 'processing',
      },
      stages: STAGES.map((s) => ({ ...s, status: 'not_started' as const, tasks: [] })),
      requirements: [],
      sources: [],
      recommendations: [],
      metrics: { progress: 0, requirementsMet: 0, requirementsTotal: 0 },
    };
  }

  if (state === 'failed') {
    return {
      application: {
        ...base,
        courseName: 'Loading course details...',
        parseStatus: 'failed',
        parseError:
          'We could not open that page. It may be private, moved, or blocking automated visits.',
      },
      stages: [],
      requirements: [],
      sources: [],
      recommendations: [],
      metrics: { progress: 0, requirementsMet: 0, requirementsTotal: 0 },
    };
  }

  return {
    application: {
      ...base,
      courseName: 'BSc Computer Science',
      country: 'United Kingdom',
      deadline: '2027-01-14',
      parseStatus: 'complete',
    },
    stages: STAGES,
    requirements: [],
    sources: [
      {
        id: 's1',
        sourceType: 'entry_requirements',
        title: 'Entry requirements',
        url: 'https://example.edu/courses/demo/entry',
        displayPriority: 0,
        isOfficial: true,
        confidence: 0.9,
        validationStatus: 'unchecked',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 's2',
        sourceType: 'how_to_apply',
        title: 'How to apply',
        url: 'https://example.edu/courses/demo/apply',
        displayPriority: 0,
        isOfficial: true,
        confidence: 0.9,
        validationStatus: 'unchecked',
        createdAt: '',
        updatedAt: '',
      },
    ],
    recommendations: [],
    metrics: { progress: 0, requirementsMet: 0, requirementsTotal: 0 },
  };
}

export default async function DevApplyWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  const { state } = await searchParams;
  const which =
    state === 'pending' || state === 'researching' || state === 'failed' ? state : 'active';

  // No wrapping <main>: the workspace ships its own chrome, same as the route.
  return (
    <ApplicationWorkspaceV2
      workspace={view(which)}
      isPlus={false}
      matchInputs={{ cv: false, essay: false, academic: false }}
      userName="Demo Student"
    />
  );
}
