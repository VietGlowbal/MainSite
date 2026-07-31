import { AdminHeading } from '../_ui';
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
    <section className="flex flex-col gap-gb-3xl">
      <AdminHeading
        title="Coordinators"
        description="Assign the coordinator role, and see every ambassador link and how much traffic each one drives."
      />
      <AdminCoordinatorsClient />
    </section>
  );
}
