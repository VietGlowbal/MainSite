import { parseScenario } from '../../fixtures';
import { CvReviewWorkspace } from './cv-review-workspace';

/** THROWAWAY DEMO — CV assessment. Delete with the folder. */
export default async function DemoCvReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario: raw } = await searchParams;
  return <CvReviewWorkspace scenario={parseScenario(raw)} />;
}
