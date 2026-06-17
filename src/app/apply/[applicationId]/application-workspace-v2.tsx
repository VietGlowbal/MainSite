/**
 * Application Workspace V2
 * Complete redesign matching the new UI spec
 */

'use client';

import { useState } from 'react';
import type { ApplicationWorkspaceView, ApplicationTask } from '@/lib/apply-types';
import { ApplicationHeader } from '@/components/apply/ApplicationHeader';
import { MetricsBar } from '@/components/apply/MetricsBar';
import { JourneyPipeline } from '@/components/apply/JourneyPipeline';
import { StagePanel } from '@/components/apply/StagePanel';
import { ProgressSidebar } from '@/components/apply/ProgressSidebar';
import { NavigationButtons } from '@/components/apply/NavigationButtons';
import { StatementFeedbackModal } from '@/components/statement/StatementFeedbackModal';
import { isStatementTask } from '@/components/statement/is-statement-task';

type Props = {
  workspace: ApplicationWorkspaceView;
};

export function ApplicationWorkspaceV2({ workspace }: Props) {
  const { application, stages, metrics, sources, recommendations } = workspace;
  
  // Find initial active stage
  const initialActiveStage = workspace.activeStage || stages[0];
  const [activeStageId, setActiveStageId] = useState(initialActiveStage?.id);

  // Find current stage
  const activeStage = stages.find(s => s.id === activeStageId) || stages[0];
  const activeStageIndex = stages.findIndex(s => s.id === activeStageId);

  // AI statement-feedback modal
  const [statementModalOpen, setStatementModalOpen] = useState(false);

  // Handle task toggle
  const handleTaskToggle = async (taskId: string, newStatus: 'completed' | 'not_started') => {
    try {
      const response = await fetch(`/api/applications/${application.id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Refresh the page to show updated progress
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Handle task action button click
  const handleTaskAction = (task: ApplicationTask) => {
    // Statement-related tasks open the AI feedback tool in-context.
    if (isStatementTask(task)) {
      setStatementModalOpen(true);
      return;
    }

    if (!task.actionType || !task.actionTarget) return;

    switch (task.actionType) {
      case 'external_url':
        window.open(task.actionTarget, '_blank');
        break;
      case 'internal_route':
        window.location.href = task.actionTarget;
        break;
      case 'upload_document':
        // TODO: Open upload modal
        console.log('Upload document:', task.actionTarget);
        break;
      case 'book_mentor':
        window.location.href = '/mentors';
        break;
      case 'recalculate_match':
        // TODO: Trigger match recalculation
        console.log('Recalculate match');
        break;
      default:
        console.log('Unknown action type:', task.actionType);
    }
  };

  // Navigation handlers
  const handlePrevious = () => {
    if (activeStageIndex > 0) {
      setActiveStageId(stages[activeStageIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (activeStageIndex < stages.length - 1) {
      setActiveStageId(stages[activeStageIndex + 1].id);
    }
  };

  // Calculate tasks for sidebar
  const allTasks = stages.flatMap(s => s.tasks || []);
  const completedTasks = allTasks.filter(t => t.status === 'completed').length;

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Header */}
        <ApplicationHeader application={application} />

        {/* Metrics */}
        <MetricsBar 
          metrics={metrics}
          entryRequirements={workspace.course?.entryRequirementsSummary}
        />

        {/* Journey Pipeline */}
        <JourneyPipeline
          stages={stages}
          activeStageId={activeStageId}
          onSelectStage={setActiveStageId}
        />

        {/* Active Stage Panel */}
        {activeStage && (
          <StagePanel
            stage={activeStage}
            stageNumber={activeStageIndex + 1}
            totalStages={stages.length}
            onTaskToggle={handleTaskToggle}
            onTaskAction={handleTaskAction}
            onStatementFeedback={() => setStatementModalOpen(true)}
          />
        )}

        {/* Navigation */}
        <NavigationButtons
          currentStageIndex={activeStageIndex}
          totalStages={stages.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      </div>

      {/* Right Sidebar */}
      <div className="hidden xl:block w-80 shrink-0">
        <ProgressSidebar
          progress={metrics.progress}
          tasksCompleted={completedTasks}
          tasksTotal={allTasks.length}
          deadline={metrics.deadline}
          recommendation={recommendations[0]}
          sources={sources}
        />
      </div>

      {statementModalOpen && (
        <StatementFeedbackModal
          applicationId={application.id}
          targetName={`${application.courseName} · ${application.universityName}`}
          contextNote={workspace.course?.entryRequirementsSummary ?? application.aiSummary}
          onClose={() => setStatementModalOpen(false)}
        />
      )}
    </div>
  );
}
