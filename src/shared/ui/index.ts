/**
 * Design-system primitives, mapped to the Untitled UI / Simple Design System
 * kit the Figma file is built on (Buttons/Button, Badge, Pagination, ...).
 *
 * Rules for anything added here:
 *  - tokens only, no raw hex (enforced by eslint.config.mjs)
 *  - no feature/app/server imports — shared/ is a leaf
 *  - no legacy class names (.glowbal-*, .auth-*, ...); see CLAUDE.md
 */
export { Button } from './button';
export type { ButtonSize, ButtonVariant } from './button';
export { CheckItem, CheckList } from './check-item';
export { Container } from './container';
export { FeatureCard } from './feature-card';
export { ICONS, KitIcon } from './icons';
export type { KitIconArt } from './icons';
export { Metric } from './metric';
export { MobileNav } from './mobile-nav';
export { Section } from './section';
export type { MobileNavAction, MobileNavItem } from './mobile-nav';
export { TopNav } from './top-nav';
export type { TopNavItem } from './top-nav';
