import { AdminHeading } from '../_ui';
import { AdminUsersClient } from './admin-users-client';

/**
 * Users admin — the actual list is fetched client-side via /api/admin/users
 * because that route uses the service role key and joins auth.users with
 * student_profiles + achiever_profiles for us.
 *
 * The /admin layout already gates non-admins.
 */
export default function AdminUsersPage() {
  return (
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="Users"
        description="Promote admins, grant or revoke GlowBal Plus access, or remove accounts. Changes apply immediately; deletions are permanent."
      />
      <AdminUsersClient />
    </section>
  );
}
