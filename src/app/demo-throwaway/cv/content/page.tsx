import { parseScenario } from '../../fixtures';
import { CvContentWorkspace } from './cv-content-workspace';

/** THROWAWAY DEMO — CV content editor. Delete with the folder. */
export default async function DemoCvContentPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario: raw } = await searchParams;
  return <CvContentWorkspace scenario={parseScenario(raw)} />;
}
