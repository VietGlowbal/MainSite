import { notFound } from 'next/navigation';
import { Container } from '@/shared/ui';
import { DashboardSummary, HierarchicalApplicationPlanner } from '@/features/ai-strategy-dashboard/ui';
import type { PlannerReadModel } from '@/features/ai-strategy-dashboard/domain';

export default function DevPlannerPage() {
  const enabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
  if (!enabled) notFound();

  const mockPlanner: PlannerReadModel = {
    plan: {
      id: 'plan-demo',
      applicationId: 'demo-vinuni',
      producer: 'core3_deterministic',
      domainPlanId: 'plan:demo',
      readiness: 'requires_enrichment',
    },
    lifecycle: 'active',
    diagnostics: [],
    phases: [
      {
        id: 'phase-1',
        domainNodeId: 'phase:1',
        title: 'Resolve required information',
        objective: 'Define the information required before detailed planning.',
        order: 1,
        sourceDecisionIds: [],
        sourceProvenances: [],
        progress: { total: 1, completed: 0, percentage: 0 },
        steps: [
          {
            id: 'step-1',
            domainNodeId: 'step:1',
            phaseId: 'phase-1',
            title: 'Clarify: Current application',
            objective: 'Define the information required before detailed planning.',
            order: 1,
            sourceDecisionIds: [],
            sourceProvenances: [],
            progress: { total: 1, completed: 0, percentage: 0 },
            microSteps: [
              {
                id: 'micro-1',
                domainNodeId: 'micro:1',
                stepId: 'step-1',
                phaseId: 'phase-1',
                title: 'Define the information required before detailed planning.',
                order: 1,
                readiness: 'requires_enrichment',
                contentSchema: null,
                sourceDecisionIds: [],
                sourceProvenances: [],
                status: 'not_started',
                deadline: null,
                contentValue: null,
                executionEvidence: [],
              },
            ],
          },
        ],
      },
      {
        id: 'phase-2',
        domainNodeId: 'phase:2',
        title: 'Confirm user choices',
        objective: 'Record the user choice; no option is selected automatically.',
        order: 2,
        sourceDecisionIds: [],
        sourceProvenances: [],
        progress: { total: 1, completed: 0, percentage: 0 },
        steps: [
          {
            id: 'step-2',
            domainNodeId: 'step:2',
            phaseId: 'phase-2',
            title: 'Choose: Application attention focus',
            objective: 'Record the user choice; no option is selected automatically.',
            order: 1,
            sourceDecisionIds: [],
            sourceProvenances: [],
            progress: { total: 1, completed: 0, percentage: 0 },
            microSteps: [
              {
                id: 'micro-2',
                domainNodeId: 'micro:2',
                stepId: 'step-2',
                phaseId: 'phase-2',
                title: 'Record the user choice; no option is selected automatically.',
                order: 1,
                readiness: 'requires_user_input',
                contentSchema: null,
                sourceDecisionIds: [],
                sourceProvenances: [],
                status: 'not_started',
                deadline: null,
                contentValue: null,
                executionEvidence: [],
              },
            ],
          },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-surface py-gb-7xl">
      <Container className="max-w-6xl">
        <div className="flex flex-col gap-gb-4xl">
          <DashboardSummary
            universityName="VinUniversity"
            courseName="Bachelor of Business Administration"
            imageUrl="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80"
            location="Vietnam"
            currentMatchPercent={72}
            deadline={null}
            recommendations={[]}
          />
          <HierarchicalApplicationPlanner
            applicationId="demo-vinuni"
            planner={mockPlanner}
          />
        </div>
      </Container>
    </main>
  );
}
