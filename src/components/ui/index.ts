/**
 * Glowbal UI primitives — central export.
 *
 * Always import from here so every page sees the same component
 * surface and breaking changes ripple out predictably.
 */

export { Button } from './button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './button';

export { Card } from './card';
export type { CardProps } from './card';

export { Badge, VerifiedBadge } from './badge';
export type { BadgeProps, BadgeTone } from './badge';

export { EmptyState } from './empty-state';
export type { EmptyStateProps } from './empty-state';

export { TrustStrip } from './trust-strip';
export type { TrustStripItem } from './trust-strip';

export { RangeSlider, DualRangeSlider } from './slider';
export type { RangeSliderProps, DualRangeSliderProps } from './slider';
