import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Legacy /achievers/[id] — redirect to the new /mentors/[id] profile page.
 */
export default async function AchieverProfileRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/mentors/${id}`);
}
