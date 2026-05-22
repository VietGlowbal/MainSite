import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<{ university?: string }>;
};

/**
 * Legacy /achievers route — superseded by the new /mentors mentorship hub.
 * We forward query params so existing links (e.g. "see mentors at Oxford")
 * keep working without breakage.
 */
export default async function AchieversLegacyRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const target = params.university
    ? `/mentors?university=${encodeURIComponent(params.university)}`
    : '/mentors';
  redirect(target);
}
