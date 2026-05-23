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
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Users</h2>
        <p className="text-sm text-slate-500">
          Promote admins or remove accounts. Admin changes apply immediately;
          deletions are permanent.
        </p>
      </div>
      <AdminUsersClient />
    </section>
  );
}
