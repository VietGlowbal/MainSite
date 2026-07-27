/**
 * Design-system primitives, mapped to the Untitled UI / Simple Design System
 * kit the Figma file is built on (Buttons/Button, Badge, Pagination, ...).
 *
 * Rules for anything added here:
 *  - tokens only, no raw hex (enforced by eslint.config.mjs)
 *  - no feature/app/server imports — shared/ is a leaf
 *  - no legacy class names (.glowbal-*, .auth-*, ...); see CLAUDE.md
 */
export { Avatar } from './avatar';
export type { AvatarSize } from './avatar';
export { Badge, admissionBadgeVariant } from './badge';
export type { BadgeVariant } from './badge';
export { Button } from './button';
export type { ButtonSize, ButtonVariant } from './button';
export { CheckItem, CheckList } from './check-item';
export { Checkbox, CheckboxGroup } from './checkbox';
export { Container } from './container';
export { FeatureCard } from './feature-card';
export { CONTROL_BASE, FormField, controlClasses } from './form-field';
export { Input } from './input';
export { Pagination, paginationRange } from './pagination';
export { Radio, RadioGroup } from './radio';
export { RatingsBadge } from './ratings-badge';
export { Select } from './select';
export { Textarea } from './textarea';
export { Footer } from './footer';
export type { FooterColumn, FooterLink, FooterSocial } from './footer';
export { BRAND_ICONS, BrandIcon, ICONS, InstagramMark, KitIcon } from './icons';
export type { BrandIconArt, KitIconArt } from './icons';
export { Metric } from './metric';
export { Modal } from './modal';
export { MobileNav } from './mobile-nav';
export { Section } from './section';
export type { MobileNavAction, MobileNavItem } from './mobile-nav';
export { TopNav } from './top-nav';
export type { TopNavItem } from './top-nav';
