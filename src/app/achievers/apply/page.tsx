import { redirect } from 'next/navigation';

/**
 * Legacy advisor signup URL — redirects to the new /advisors/apply page.
 */
export default function AchieverApplyRedirect() {
  redirect('/advisors/apply');
}
