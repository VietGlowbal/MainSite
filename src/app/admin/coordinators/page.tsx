import { AdminCoordinatorsClient } from './admin-coordinators-client';

/**
 * Coordinators admin — lists coordinator share links with their visit stats and
 * lets an admin grant/revoke the coordinator role. Data is fetched client-side
 * via /api/admin/coordinators + /api/admin/users (both service-role).
 *
 * The /admin layout already gates non-admins.
 */
export default function AdminCoordinatorsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Coordinators</h2>
        <p className="text-sm text-slate-500">
          Grant the coordinator role to give someone a trackable share link, and
          see how much traffic each one drives.
        </p>
      </div>
      <AdminCoordinatorsClient />
    </section>
  );
}
