/**
 * `/how-it-works`' guide, as its own slice.
 *
 * Same reason as ./navigation.ts: reaching `@/features/marketing/ui` for this
 * would drag the Home compositions — and framer-motion with them — onto a page
 * that animates nothing. See docs/performance.md.
 */
export { GuidePanel, StrategyGuide } from './ui/strategy-guide';
