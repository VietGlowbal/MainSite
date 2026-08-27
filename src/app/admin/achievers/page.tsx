import { redirect } from 'next/navigation';
import { listAdvisorApplicationsForAdmin } from '@/features/mentorship/api';
import { AdminHeading } from '../_ui';
import { AdminAchieversClient } from './admin-achievers-client';

/**
 * Mentor application review. The /admin layout gates the UI and renders the
 * page header + tabs; the repository independently verifies authorization at
 * the privileged data boundary.
 */
export default async function AdminAchieversPage() {
  const result = await listAdvisorApplicationsForAdmin();
  if (!result.ok) {
    if (result.status === 401) redirect('/auth?redirect=/admin/achievers');
    if (result.status === 403) redirect('/apply');
    throw new Error(result.error);
  }

  return (
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="Advisor applications"
        description="Approve or reject incoming advisor signups."
      />
      <AdminAchieversClient applications={result.applications} />
    </section>
  );
}
