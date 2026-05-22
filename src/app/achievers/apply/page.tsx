import { redirect } from 'next/navigation';

/**
 * Legacy mentor signup URL — redirects to the new /mentors/apply page.
 */
export default function AchieverApplyRedirect() {
  redirect('/mentors/apply');
}
