import { redirect } from 'next/navigation';

/** Legacy availability page → redirects to the unified mentor dashboard. */
export default function AchieverAvailabilityRedirect() {
  redirect('/dashboard/mentor');
}
