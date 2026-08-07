import { redirect } from 'next/navigation';

/**
 * Legacy /dashboard/achiever route — redirects to the new /dashboard/advisor.
 */
export default function AchieverDashboardRedirect() {
  redirect('/dashboard/advisor');
}
