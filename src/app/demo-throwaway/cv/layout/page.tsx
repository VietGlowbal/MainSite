import { parseScenario } from '../../fixtures';
import { CvLayoutWorkspace } from './cv-layout-workspace';

/** THROWAWAY DEMO — layout selection and PDF export. Delete with the folder. */
export default async function DemoCvLayoutPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario: raw } = await searchParams;
  return <CvLayoutWorkspace scenario={parseScenario(raw)} />;
}
