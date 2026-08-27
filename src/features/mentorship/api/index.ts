/**
 * mentorship — data access (server-only).
 *
 * Exposes repository ports and their adapters. This is the ONLY slice in the
 * feature permitted to reach the database. Consumers import the port type, not
 * the adapter, so the implementation stays swappable (and fake-able in tests).
 */
export {
  decideAdvisorApplication,
  listAdvisorApplicationsForAdmin,
} from './admin-advisor-applications';
export type {
  AdminAdvisorApplication,
  AdvisorApplicationDecision,
  AdvisorApplicationDecisionResult,
  AdvisorApplicationListResult,
} from './admin-advisor-applications';
