import { redirect } from 'next/navigation';

/** Legacy alias retained for bookmarks and onboarding redirects. */
export default async function LegacyStrategyRecommendationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/ai-strategy/${applicationId}/strategy-report`);
}
