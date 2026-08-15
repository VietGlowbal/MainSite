/**
 * Design-system primitives, mapped to the Untitled UI / Simple Design System
 * kit the Figma file is built on (Buttons/Button, Badge, Pagination, ...).
 *
 * Rules for anything added here:
 *  - tokens only, no raw hex (enforced by eslint.config.mjs)
 *  - no feature/app/server imports — shared/ is a leaf
 *  - no legacy class names (.glowbal-*, .auth-*, ...); see CLAUDE.md
 */
export { DonutChart, HorizontalBarChart, MetricBar, RadarChart } from './charts';
export type {
  DonutChartSegment,
  HorizontalBarChartDatum,
  MetricBarTone,
  RadarChartDatum,
} from './charts';
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
export { MonthPicker } from './month-picker';
export { Pagination, paginationRange } from './pagination';
export { Radio, RadioGroup } from './radio';
export { RatingsBadge } from './ratings-badge';
export { Select } from './select';
export { Textarea } from './textarea';
export { Footer } from './footer';
export type { FooterColumn, FooterLink, FooterSocial } from './footer';
export {
  BRAND_ICONS,
  BrandIcon,
  ICONS,
  InstagramMark,
  KitIcon,
  SearchMark,
  VerifiedMark,
} from './icons';
export type { BrandIconArt, KitIconArt } from './icons';
export { GlobeLoader, LoadingScreen, PageLoaderOverlay, usePrefersReducedMotion } from './globe-loader';
export type { GlobeLoaderSize } from './globe-loader';
export { LOADING_PHRASES, nextPhraseIndex } from './loading-phrases';
export type { LoadingPhrase } from './loading-phrases';
/**
 * The loading store and its hooks.
 *
 * ⚠️ Import these from '@/shared/ui/loading-overlay', NOT from this barrel,
 * unless you are also pulling a component out of it. They are re-exported here
 * for discoverability, but a module that wants one hook and reaches through the
 * barrel to get it drags every primitive above into its graph.
 *
 * That is not a style preference. The forty-odd call sites for
 * `useLoadingIndicator` include components that are under test, and pulling the
 * whole design system into those tests moved ~300 uncovered branches into the
 * coverage denominator — enough to break the ratchet in vitest.config.ts on its
 * own. It is also dead weight in the client bundle of every page that saves a
 * form.
 */
export {
  GlobalLoadingOverlay,
  beginLoading,
  useBeginLoading,
  useLoadingIndicator,
  useLoadingSnapshot,
} from './loading-overlay';
export { DocumentRow, formatBytes } from './document-row';
export type { DocumentStatus } from './document-row';
export { FileDropzone } from './file-dropzone';
export { ProgressBar } from './progress-bar';
export { RangeHistogram } from './range-histogram';
export { RepeatableFieldset } from './repeatable-fieldset';
export { ScoreRing, scoreRingColor } from './score-ring';
export type { ScoreRingMeasure, ScoreRingSize } from './score-ring';
export { Stepper } from './stepper';
export type { StepperStep } from './stepper';
export { Metric } from './metric';
export { Panel, PanelHeader, StatTile } from './panel';
export type { PanelElevation, PanelPadding, StatTone } from './panel';
export { MultiSelect } from './multi-select';
export type { MultiSelectOption } from './multi-select';
export { Modal } from './modal';
export { MobileNav } from './mobile-nav';
export { Section } from './section';
export type { MobileNavAction, MobileNavEntry, MobileNavGroup, MobileNavItem } from './mobile-nav';
export { isNavGroup, isNavLinkActive } from './nav-model';
export type { NavEntry, NavGroup, NavLink } from './nav-model';
export { TopNav } from './top-nav';
export { NAV_HIDDEN_EVENT, useNavReveal } from './use-nav-reveal';
export { Breadcrumbs } from './breadcrumbs';
export type { BreadcrumbsTone } from './breadcrumbs';
export { SubNav } from './sub-nav';
export type { SubNavTone } from './sub-nav';
export type { TopNavEntry, TopNavGroup, TopNavItem } from './top-nav';
