import { redirect } from 'next/navigation';

/** Legacy availability page → redirects to the unified advisor dashboard. */
export default function AchieverAvailabilityRedirect() {
  redirect('/dashboard/advisor');
}
