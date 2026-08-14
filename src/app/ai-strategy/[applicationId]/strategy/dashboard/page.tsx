import { redirect } from 'next/navigation';

/** Legacy alias retained for bookmarks and onboarding redirects. */
export default async function LegacyStrategyDashboardPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/ai-strategy/${applicationId}/planner`);
}
