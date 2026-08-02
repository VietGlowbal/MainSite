import { parseScenario } from '../fixtures';
import { StatementWorkspace } from './statement-workspace';

/** THROWAWAY DEMO — personal statement workspace. Delete with the folder. */
export default async function DemoStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; section?: string }>;
}) {
  const { scenario: raw, section } = await searchParams;
  return <StatementWorkspace scenario={parseScenario(raw)} initialSection={section} />;
}
