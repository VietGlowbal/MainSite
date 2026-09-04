/**
 * auth — data access (server-only).
 *
 * Exposes repository ports and their adapters. This is the ONLY slice in the
 * feature permitted to reach the database. Consumers import the port type, not
 * the adapter, so the implementation stays swappable (and fake-able in tests).
 */
export { checkPasswordBreach } from './pwned-passwords';
export type { BreachCheck, BreachCheckDeps } from './pwned-passwords';
export { redeemRecoveryToken } from './password-reset';
export type { ResetOutcome } from './password-reset';
export { changeOwnPassword } from './password-change';
export type { PasswordChangeInput, PasswordChangeOutcome } from './password-change';
