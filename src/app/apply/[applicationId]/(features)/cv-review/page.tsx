import { redirect } from 'next/navigation';

export default async function CvReviewPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  redirect(`/ai-strategy/${applicationId}/cv/review`);
}
