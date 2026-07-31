import { parseScenario } from '../../fixtures';
import { TargetProfileWorkspace } from './target-profile-workspace';

/** THROWAWAY DEMO — Target Profile. Delete with the folder. */
export default async function DemoTargetProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario: raw } = await searchParams;
  return <TargetProfileWorkspace scenario={parseScenario(raw)} />;
}
