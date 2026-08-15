import { redirect } from 'next/navigation';

/** Legacy Matching Report URL retained as a compatibility alias. */
export default async function LegacyMatchingReportPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/ai-strategy/${applicationId}/matching-report`);
}
