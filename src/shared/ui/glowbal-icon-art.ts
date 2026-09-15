/**
 * Every product icon GlowbalIcon can draw: the 72 from the icon plan
 * (glowbal-icons.ts, generated from the plan) plus the 27 shipped icons redrawn
 * as vectors (glowbal-icons-shipped.ts). Import names from here, never from
 * either half — a call site should not need to know which set an icon came from.
 *
 * A spread, so a key present in both would silently keep only the shipped one;
 * glowbal-icon.test.tsx fails if that ever happens.
 */

import { GLOWBAL_ICONS as PLAN_ICONS } from './glowbal-icons';
import { GLOWBAL_SHIPPED_ICONS } from './glowbal-icons-shipped';

export const GLOWBAL_ICONS = { ...PLAN_ICONS, ...GLOWBAL_SHIPPED_ICONS } as const;

export type GlowbalIconName = keyof typeof GLOWBAL_ICONS;

/** Narrows a name that arrives as data (a route model, a CMS row) to one this set can draw. */
export function isGlowbalIconName(name: string): name is GlowbalIconName {
  return Object.prototype.hasOwnProperty.call(GLOWBAL_ICONS, name);
}
