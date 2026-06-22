import { AmbassadorsClient } from './ambassadors-client';

/**
 * Coordinator dashboard — manage ambassador share links and track how much
 * traffic each ambassador drives. Data is fetched client-side via
 * /api/coordinator/ambassadors (service-role, scoped to this coordinator).
 *
 * The /coordinator layout already gates non-coordinators.
 */
export default function CoordinatorPage() {
  return <AmbassadorsClient />;
}
