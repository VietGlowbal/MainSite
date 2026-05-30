import { redirect } from 'next/navigation';

/**
 * Legacy my-universities URL — redirects to the new /apply page.
 */
export default function MyUniversitiesRedirect() {
  redirect('/apply');
}
