import { redirect } from 'next/navigation';
import {
  getAdminAiReportReview,
  listAdminAiReportReview,
} from '@/features/ai-strategy-dashboard/api';
import { AdminHeading } from '../_ui';
import { AdminAiReportReviewClient } from './admin-ai-report-review-client';

export default async function AdminAiReportReviewPage() {
  const list = await listAdminAiReportReview();
  if (!list.ok) {
    if (list.status === 401) redirect('/auth?redirect=/admin/ai-report-review');
    if (list.status === 403) redirect('/apply');
    throw new Error(list.error);
  }

  const first = list.items[0];
  const initial = first ? await getAdminAiReportReview(first.applicationId) : null;
  if (initial && !initial.ok) throw new Error(initial.error);

  return (
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="AI report review"
        description="Trace the latest Personal, Matching and Strategy report for each application."
      />
      <AdminAiReportReviewClient items={list.items} initialReview={initial?.review ?? null} />
    </section>
  );
}
